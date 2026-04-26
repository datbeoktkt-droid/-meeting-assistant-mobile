import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config/app_config.dart';
import '../models/app_models.dart';

class ApiException implements Exception {
  ApiException(this.message);
  final String message;
  @override
  String toString() => message;
}

class ApiClient {
  const ApiClient();

  Future<Map<String, dynamic>> login({
    required String phone,
    required String pin,
  }) {
    return post(
      '/auth/login',
      body: {'phone': phone, 'pin': pin, 'deviceName': 'flutter-user-app'},
    );
  }

  Future<Map<String, dynamic>> register({
    required String fullName,
    required String phone,
    required String pin,
  }) {
    return post(
      '/auth/register',
      body: {'fullName': fullName, 'phone': phone, 'pin': pin},
    );
  }

  Future<Map<String, dynamic>> post(
    String path, {
    Map<String, dynamic>? body,
    String? token,
  }) async {
    final response = await http.post(
      Uri.parse('${ApiConfig.appBase}$path'),
      headers: _headers(token),
      body: jsonEncode(body ?? <String, dynamic>{}),
    );
    return _decodeMap(response);
  }

  Future<dynamic> get(String path, {String? token}) async {
    final response = await http.get(
      Uri.parse('${ApiConfig.appBase}$path'),
      headers: _headers(token),
    );
    return _decode(response);
  }

  Future<HomeBundle> fetchHome(String token) async {
    final responses = await Future.wait<dynamic>([
      get('/me', token: token),
      get('/sessions/active', token: token),
      get('/tables', token: token),
    ]);
    final user = AppUser.fromJson(responses[0] as Map<String, dynamic>);
    final sessionWrap = responses[1] as Map<String, dynamic>;
    final tables = (responses[2] as List<dynamic>)
        .whereType<Map<String, dynamic>>()
        .map(TableInfo.fromJson)
        .toList();
    return HomeBundle(
      user: user,
      activeSession: sessionWrap['active_session'] == null
          ? null
          : ActiveSessionData.fromJson(
              sessionWrap['active_session'] as Map<String, dynamic>,
            ),
      tables: tables,
    );
  }

  Future<List<ProductInfo>> fetchMenu(String token) async {
    final result = await get('/menu', token: token);
    return (result as List<dynamic>)
        .whereType<Map<String, dynamic>>()
        .map(ProductInfo.fromJson)
        .toList();
  }

  Future<MembershipData> fetchMembership(String token) async {
    final result = await get('/membership', token: token);
    return MembershipData.fromJson(result as Map<String, dynamic>);
  }

  Future<WalletData> fetchWallet(String token) async {
    final result = await get('/wallet', token: token);
    return WalletData.fromJson(result as Map<String, dynamic>);
  }

  Future<List<TableInfo>> fetchTables(String token) async {
    final result = await get('/tables', token: token);
    return (result as List<dynamic>)
        .whereType<Map<String, dynamic>>()
        .map(TableInfo.fromJson)
        .toList();
  }

  Future<List<BookingInfo>> fetchBookings(String token) async {
    final result = await get('/bookings', token: token);
    return (result as List<dynamic>)
        .whereType<Map<String, dynamic>>()
        .map(BookingInfo.fromJson)
        .toList();
  }

  Future<List<OrderHistoryItem>> fetchHistory(String token) async {
    final result = await get('/history', token: token);
    return (result as List<dynamic>)
        .whereType<Map<String, dynamic>>()
        .map(OrderHistoryItem.fromJson)
        .toList();
  }

  Future<OrderDetail> fetchHistoryDetail(String token, int orderId) async {
    final result = await get('/history/$orderId', token: token);
    return OrderDetail.fromJson(result as Map<String, dynamic>);
  }

  Future<AppUser> fetchProfile(String token) async {
    final result = await get('/me', token: token);
    return AppUser.fromJson(result as Map<String, dynamic>);
  }

  Future<AppUser> updateProfile({
    required String token,
    required String fullName,
    String? avatarUrl,
  }) async {
    final result = await httpPatch(
      '/me',
      token: token,
      body: {'fullName': fullName, 'avatarUrl': avatarUrl},
    );
    return AppUser.fromJson(result['user'] as Map<String, dynamic>);
  }

  Future<void> changePin({
    required String token,
    required String currentPin,
    required String newPin,
  }) async {
    await post(
      '/change-pin',
      token: token,
      body: {'currentPin': currentPin, 'newPin': newPin},
    );
  }

  Future<Map<String, dynamic>> createBooking({
    required String token,
    required int tableId,
    required DateTime bookingStart,
    required int durationMinutes,
    String? notes,
  }) {
    return post(
      '/bookings',
      token: token,
      body: {
        'tableId': tableId,
        'bookingStart': bookingStart.toIso8601String(),
        'durationMinutes': durationMinutes,
        'notes': notes,
      },
    );
  }

  Future<Map<String, dynamic>> cancelBooking({
    required String token,
    required int bookingId,
  }) {
    return httpPatch('/bookings/$bookingId/cancel', token: token);
  }

  Future<Map<String, dynamic>> extendBooking({
    required String token,
    required int bookingId,
    required int extraMinutes,
  }) {
    return httpPatch(
      '/bookings/$bookingId/extend',
      token: token,
      body: {'extraMinutes': extraMinutes},
    );
  }

  Future<Map<String, dynamic>> httpPatch(
    String path, {
    Map<String, dynamic>? body,
    String? token,
  }) async {
    final response = await http.patch(
      Uri.parse('${ApiConfig.appBase}$path'),
      headers: _headers(token),
      body: jsonEncode(body ?? <String, dynamic>{}),
    );
    return _decodeMap(response);
  }

  Map<String, String> _headers(String? token) {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  dynamic _decode(http.Response response) {
    final payload = response.body.isEmpty ? null : jsonDecode(response.body);
    if (response.statusCode >= 400) {
      if (payload is Map<String, dynamic> && payload['error'] != null) {
        throw ApiException(payload['error'].toString());
      }
      throw ApiException('Yeu cau that bai: ${response.statusCode}');
    }
    return payload;
  }

  Map<String, dynamic> _decodeMap(http.Response response) {
    final payload = _decode(response);
    if (payload is Map<String, dynamic>) {
      return payload;
    }
    throw ApiException('Du lieu tra ve khong hop le');
  }
}
