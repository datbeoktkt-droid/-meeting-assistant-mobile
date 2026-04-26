part of '../app.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.session, required this.onLogout});

  final UserSession session;
  final VoidCallback onLogout;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final ApiClient _api = const ApiClient();
  late final NotificationStreamClient _notificationClient;
  late UserSession _session;
  int _index = 0;
  int _refreshSignal = 0;
  String _liveNotice = 'Dang ket noi du lieu thoi gian thuc';

  @override
  void initState() {
    super.initState();
    _session = widget.session;
    _notificationClient = createNotificationStreamClient();
    _notificationClient.connect(
      url: '${ApiConfig.baseUrl}/api/notifications/stream',
      onEvent: _handleRealtimeEvent,
      onError: (_) {
        if (!mounted) {
          return;
        }
        setState(() {
          _liveNotice = 'Ket noi realtime dang duoc thu lai';
        });
      },
    );
  }

  @override
  void dispose() {
    _notificationClient.dispose();
    super.dispose();
  }

  void _handleRealtimeEvent(NotificationEvent event) {
    final currentUserId = _session.user.userId;
    final payloadUserId = toInt(event.data['user_id']);
    final bookingEvents = <String>{
      'booking:new',
      'booking:reserved',
      'booking:checked_in',
      'booking:completed',
      'booking:cancelled',
      'booking:extended',
      'booking:expired',
      'booking:updated',
    };

    final shouldRefresh =
        (bookingEvents.contains(event.type) && payloadUserId == currentUserId) ||
        (event.type == 'topup:reviewed' && payloadUserId == currentUserId) ||
        (event.type == 'order:new' && payloadUserId == currentUserId) ||
        (event.type == 'session:completed' && payloadUserId == currentUserId);

    if (!shouldRefresh || !mounted) {
      return;
    }

    setState(() {
      _refreshSignal++;
      _liveNotice = switch (event.type) {
        'booking:reserved' => 'Booking cua ban da duoc giu cho',
        'booking:checked_in' => 'Ban da duoc check-in',
        'booking:completed' => 'Luot dat ban da hoan tat',
        'booking:cancelled' => 'Booking da bi huy',
        'booking:expired' => 'Booking da het han',
        'topup:reviewed' => 'Yeu cau nap tien vua duoc cap nhat',
        'session:completed' => 'Ban vua duoc dong va thanh toan',
        _ => 'Du lieu vua duoc cap nhat',
      };
    });
  }

  Future<void> _openExtraPage(Widget page, String title) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => Scaffold(
          appBar: AppBar(title: Text(title)),
          body: page,
        ),
      ),
    );
  }

  Future<void> _openProfilePage() async {
    final updatedUser = await Navigator.of(context).push<AppUser>(
      MaterialPageRoute(
        builder: (_) => Scaffold(
          appBar: AppBar(title: const Text('Ho so')),
          body: _ProfilePage(
            api: _api,
            token: _session.token,
            user: _session.user,
          ),
        ),
      ),
    );

    if (updatedUser != null && mounted) {
      setState(() {
        _session = UserSession(
          token: _session.token,
          refreshToken: _session.refreshToken,
          user: updatedUser,
        );
      });
    }
  }

  Future<void> _logout() async {
    try {
      await _api.post(
        '/auth/logout',
        token: _session.token,
        body: {'refreshToken': _session.refreshToken},
      );
    } catch (_) {}
    if (mounted) {
      widget.onLogout();
    }
  }

  @override
  Widget build(BuildContext context) {
    final pages = [
      _HomePage(
        api: _api,
        token: _session.token,
        refreshSignal: _refreshSignal,
        onOpenBooking: () => setState(() => _index = 1),
        onOpenMenu: () => setState(() => _index = 2),
        onOpenWallet: () => setState(() => _index = 3),
        onOpenHistory: () => _openExtraPage(
          _HistoryPage(api: _api, token: _session.token),
          'Lich su',
        ),
        onOpenRewards: () => _openExtraPage(
          _RewardsPage(api: _api, token: _session.token),
          'Thanh vien',
        ),
        user: _session.user,
      ),
      _BookingPage(
        api: _api,
        token: _session.token,
        refreshSignal: _refreshSignal,
      ),
      _MenuPage(
        api: _api,
        token: _session.token,
        refreshSignal: _refreshSignal,
      ),
      _WalletPage(
        api: _api,
        token: _session.token,
        refreshSignal: _refreshSignal,
      ),
    ];

    return Scaffold(
      backgroundColor: const Color(0xFF061017),
      appBar: AppBar(
        backgroundColor: const Color(0xFF061017),
        surfaceTintColor: Colors.transparent,
        leadingWidth: 72,
        leading: Padding(
          padding: const EdgeInsets.only(left: 20, top: 8, bottom: 8),
          child: CircleAvatar(
            backgroundColor: const Color(0xFF9EF9B7),
            child: CircleAvatar(
              radius: 20,
              backgroundColor: Colors.white,
              backgroundImage: NetworkImage(
                buildAvatarUrl(
                  userId: _session.user.userId,
                  phone: _session.user.phone,
                ),
              ),
            ),
          ),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Chao mung tro lai,',
              style: TextStyle(color: Color(0xFF9AA7AF), fontSize: 14),
            ),
            Text(
              _session.user.fullName,
              style: const TextStyle(
                color: Color(0xFF9EF9B7),
                fontSize: 18,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
        actions: [
          PopupMenuButton<String>(
            color: const Color(0xFF13212B),
            icon: Container(
              margin: const EdgeInsets.only(right: 20),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFF111E27),
                borderRadius: BorderRadius.circular(18),
              ),
              child: const Icon(
                Icons.notifications_none,
                color: Color(0xFF9EF9B7),
              ),
            ),
            onSelected: (value) async {
              if (value == 'profile') {
                await _openProfilePage();
                return;
              }
              if (value == 'history') {
                await _openExtraPage(
                  _HistoryPage(api: _api, token: _session.token),
                  'Lich su',
                );
                return;
              }
              if (value == 'rewards') {
                await _openExtraPage(
                  _RewardsPage(api: _api, token: _session.token),
                  'Thanh vien',
                );
                return;
              }
              if (value == 'logout') {
                await _logout();
              }
            },
            itemBuilder: (context) => const [
              PopupMenuItem(value: 'profile', child: Text('Ho so')),
              PopupMenuItem(value: 'history', child: Text('Lich su')),
              PopupMenuItem(value: 'rewards', child: Text('Thanh vien')),
              PopupMenuDivider(),
              PopupMenuItem(value: 'logout', child: Text('Dang xuat')),
            ],
          ),
        ],
      ),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 10),
            color: const Color(0xFF061017),
            child: Text(
              _liveNotice,
              style: const TextStyle(
                color: Color(0xFF8DB8A2),
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Expanded(
            child: IndexedStack(index: _index, children: pages),
          ),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        backgroundColor: const Color(0xFF0C1820),
        indicatorColor: const Color(0xFF163228),
        labelTextStyle: WidgetStateProperty.all(
          const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
        ),
        selectedIndex: _index,
        onDestinationSelected: (value) => setState(() => _index = value),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            label: 'Trang chu',
          ),
          NavigationDestination(
            icon: Icon(Icons.event_seat_outlined),
            label: 'Dat ban',
          ),
          NavigationDestination(
            icon: Icon(Icons.local_cafe_outlined),
            label: 'Thuc don',
          ),
          NavigationDestination(
            icon: Icon(Icons.account_balance_wallet_outlined),
            label: 'Vi',
          ),
        ],
      ),
    );
  }
}
