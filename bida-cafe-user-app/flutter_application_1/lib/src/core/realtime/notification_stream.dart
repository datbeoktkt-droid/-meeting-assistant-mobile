import 'notification_stream_stub.dart'
    if (dart.library.html) 'notification_stream_web.dart';

class NotificationEvent {
  const NotificationEvent({
    required this.type,
    required this.data,
  });

  final String type;
  final Map<String, dynamic> data;
}

abstract class NotificationStreamClient {
  void connect({
    required String url,
    required void Function(NotificationEvent event) onEvent,
    void Function(Object error)? onError,
  });

  void dispose();
}

NotificationStreamClient createNotificationStreamClient() =>
    createNotificationStreamClientImpl();
