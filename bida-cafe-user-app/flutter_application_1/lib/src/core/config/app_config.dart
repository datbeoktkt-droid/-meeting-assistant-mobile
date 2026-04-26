import 'package:flutter/foundation.dart';

class ApiConfig {
  static String get baseUrl => kIsWeb ? 'http://localhost:3000' : 'http://10.0.2.2:3000';
  static String get appBase => '$baseUrl/api/app';
}

String buildAvatarUrl({required int userId, required String phone}) {
  final seed = Uri.encodeComponent('$userId-$phone');
  return 'https://api.dicebear.com/9.x/identicon/png?seed=$seed&backgroundType=gradientLinear';
}

String labelTableStatus(String status) {
  switch (status.toUpperCase()) {
    case 'AVAILABLE':
      return 'Con trong';
    case 'RESERVED':
      return 'Da giu cho';
    case 'ACTIVE':
    case 'IN_USE':
      return 'Dang choi';
    case 'CLEANING':
      return 'Dang don';
    default:
      return status;
  }
}

String labelOrderStatus(String status) {
  switch (status.toUpperCase()) {
    case 'DONE':
      return 'Da thanh toan';
    case 'PENDING_PAYMENT':
      return 'Cho thanh toan';
    case 'PENDING':
      return 'Dang xu ly';
    case 'CANCELLED':
      return 'Da huy';
    default:
      return status;
  }
}

String labelOrderType(String type) {
  switch (type.toUpperCase()) {
    case 'CAFE':
      return 'Do uong';
    case 'BILLIARD':
      return 'Tien ban';
    default:
      return type;
  }
}

String formatCurrency(num amount) {
  final digits = amount.round().toString();
  final buffer = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    final reverseIndex = digits.length - i;
    buffer.write(digits[i]);
    if (reverseIndex > 1 && reverseIndex % 3 == 1) {
      buffer.write(',');
    }
  }
  return '$buffer VND';
}

String formatDate(DateTime? date) {
  if (date == null) {
    return 'Khong ro thoi gian';
  }
  final hour = date.hour.toString().padLeft(2, '0');
  final minute = date.minute.toString().padLeft(2, '0');
  final day = date.day.toString().padLeft(2, '0');
  final month = date.month.toString().padLeft(2, '0');
  return '$hour:$minute $day/$month/${date.year}';
}

double toDouble(dynamic value) {
  if (value == null) {
    return 0;
  }
  if (value is num) {
    return value.toDouble();
  }
  return double.tryParse(value.toString()) ?? 0;
}

int toInt(dynamic value) {
  if (value == null) {
    return 0;
  }
  if (value is int) {
    return value;
  }
  if (value is num) {
    return value.toInt();
  }
  return int.tryParse(value.toString()) ?? 0;
}
