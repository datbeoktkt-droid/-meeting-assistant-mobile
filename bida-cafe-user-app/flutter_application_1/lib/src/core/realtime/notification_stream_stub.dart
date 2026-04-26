import 'notification_stream.dart';

class _NoopNotificationStreamClient implements NotificationStreamClient {
  @override
  void connect({
    required String url,
    required void Function(NotificationEvent event) onEvent,
    void Function(Object error)? onError,
  }) {}

  @override
  void dispose() {}
}

NotificationStreamClient createNotificationStreamClientImpl() =>
    _NoopNotificationStreamClient();
