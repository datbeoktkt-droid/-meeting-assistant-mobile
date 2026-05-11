import 'dart:async';
import 'dart:convert';
import 'dart:html' as html;

import 'notification_stream.dart';

const _eventTypes = <String>[
  'booking:new',
  'booking:reserved',
  'booking:checked_in',
  'booking:completed',
  'booking:cancelled',
  'booking:extended',
  'booking:expired',
  'booking:updated',
  'order:new',
  'topup:reviewed',
  'session:completed',
  'table:status_changed',
  'table:available',
  'table:cleaning',
];

class _WebNotificationStreamClient implements NotificationStreamClient {
  html.EventSource? _source;
  final List<StreamSubscription<dynamic>> _subscriptions = [];

  @override
  void connect({
    required String url,
    required void Function(NotificationEvent event) onEvent,
    void Function(Object error)? onError,
  }) {
    dispose();

    final source = html.EventSource(url);
    _source = source;

    // Nghe tat ca cac su kien tu tin nhan mac dinh (onMessage)
    _subscriptions.add(
      source.onMessage.listen((event) {
        try {
          final rawData = event.data;
          final map = rawData is String
              ? jsonDecode(rawData) as Map<String, dynamic>
              : <String, dynamic>{};
          
          // Lay type tu trong data ra
          final type = map['type'] as String?;
          final data = map['data'] as Map<String, dynamic>? ?? {};
          
          if (type != null) {
            onEvent(NotificationEvent(type: type, data: data));
          }
        } catch (error) {
          onError?.call(error);
        }
      }),
    );

    _subscriptions.add(
      source.onError.listen((event) {
        onError?.call(event);
      }),
    );
  }

  @override
  void dispose() {
    for (final subscription in _subscriptions) {
      subscription.cancel();
    }
    _subscriptions.clear();
    _source?.close();
    _source = null;
  }
}

NotificationStreamClient createNotificationStreamClientImpl() =>
    _WebNotificationStreamClient();
