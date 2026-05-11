import 'package:flutter/material.dart';
import 'dart:async';
import 'dart:math' as math;

import 'api.dart';
import 'helpers.dart';
import 'models.dart';
import 'core/realtime/notification_stream.dart';
import 'core/config/app_config.dart';

part 'screens/login_screen.dart';
part 'screens/home_screen.dart';
part 'screens/home_page.dart';
part 'screens/booking_screen.dart';
part 'screens/menu_screen.dart';
part 'screens/history_screen.dart';
part 'screens/order_detail_screen.dart';
part 'screens/profile_screen.dart';
part 'screens/rewards_screen.dart';
part 'screens/wallet_screen.dart';
part 'widgets/booking_form_sheet.dart';
part 'widgets/form_widgets.dart';
part 'widgets/card_widgets.dart';
part 'widgets/state_widgets.dart';

class BidaCafeUserApp extends StatefulWidget {
  const BidaCafeUserApp({super.key});

  @override
  State<BidaCafeUserApp> createState() => _BidaCafeUserAppState();
}

class _BidaCafeUserAppState extends State<BidaCafeUserApp> {
  UserSession? _session;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Bida & Coffee 82',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF0A8F78)),
        scaffoldBackgroundColor: const Color(0xFFF2F6F5),
        useMaterial3: true,
      ),
      home: _session == null
          ? LoginScreen(
              onLogin: (session) => setState(() => _session = session),
            )
          : HomeScreen(
              session: _session!,
              onLogout: () => setState(() => _session = null),
            ),
    );
  }
}
