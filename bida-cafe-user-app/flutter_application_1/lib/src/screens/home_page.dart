part of '../app.dart';

class _HomePage extends StatefulWidget {
  const _HomePage({
    required this.api,
    required this.token,
    required this.refreshSignal,
    required this.onOpenBooking,
    required this.onOpenMenu,
    required this.onOpenWallet,
    required this.onOpenHistory,
    required this.onOpenRewards,
    required this.user,
  });

  final ApiClient api;
  final String token;
  final int refreshSignal;
  final VoidCallback onOpenBooking;
  final VoidCallback onOpenMenu;
  final VoidCallback onOpenWallet;
  final VoidCallback onOpenHistory;
  final VoidCallback onOpenRewards;
  final AppUser user;

  @override
  State<_HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<_HomePage> {
  late Future<HomeBundle> _future;

  Color _tableCardColor(TableInfo table) {
    if (table.isVip) {
      return const Color(0xFF161E24);
    }
    return const Color(0xFF16212A);
  }

  @override
  void initState() {
    super.initState();
    _future = widget.api.fetchHome(widget.token);
  }

  @override
  void didUpdateWidget(covariant _HomePage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.refreshSignal != widget.refreshSignal) {
      _reload();
    }
  }

  Future<void> _reload() async {
    final nextFuture = widget.api.fetchHome(widget.token);
    setState(() {
      _future = nextFuture;
    });
    await nextFuture;
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<HomeBundle>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError) {
          return _ErrorState(message: snapshot.error.toString());
        }
        final data = snapshot.data!;
        final availableCount = data.tables
            .where((item) => item.isAvailable)
            .length;
        final tableCards = data.tables.take(4).toList();
        return RefreshIndicator(
          onRefresh: _reload,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
            children: [
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: const Color(0xFF121F28),
                  borderRadius: BorderRadius.circular(30),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Expanded(
                          child: Text(
                            'So du kha dung',
                            style: TextStyle(
                              color: Color(0xFFA8B4BA),
                              fontSize: 16,
                            ),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: const Color(0xFF243A34),
                            borderRadius: BorderRadius.circular(18),
                          ),
                          child: const Icon(
                            Icons.account_balance_wallet_outlined,
                            color: Color(0xFF9EF9B7),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    RichText(
                      text: TextSpan(
                        children: [
                          TextSpan(
                            text: '${data.user.walletBalance.round()}',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 42,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const TextSpan(
                            text: ' VND',
                            style: TextStyle(
                              color: Color(0xFF9EF9B7),
                              fontSize: 20,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 18),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        onPressed: widget.onOpenWallet,
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFF9EF9B7),
                          foregroundColor: const Color(0xFF143125),
                          padding: const EdgeInsets.symmetric(vertical: 18),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(18),
                          ),
                        ),
                        icon: const Icon(Icons.add_circle_outline),
                        label: const Text(
                          'NAP THEM',
                          style: TextStyle(
                            fontWeight: FontWeight.w900,
                            letterSpacing: 0.6,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              if (data.activeSession != null) ...[
                _ActiveSessionCard(
                  activeSession: data.activeSession!,
                  onOpenMenu: widget.onOpenMenu,
                ),
                const SizedBox(height: 14),
              ],
              Row(
                children: [
                  Expanded(
                    child: _MiniStat(
                      label: 'Ban dang trong',
                      value: '$availableCount',
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _MiniStat(
                      label: 'Ban dang choi',
                      value: '${data.tables.length - availableCount}',
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: _QuickActionCard(
                      icon: Icons.flag_outlined,
                      title: 'DAT BAN',
                      subtitle: 'Giu cho',
                      onTap: widget.onOpenBooking,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _QuickActionCard(
                      icon: Icons.restaurant_outlined,
                      title: 'GOI MON',
                      subtitle: 'Do uong',
                      onTap: widget.onOpenMenu,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _QuickActionCard(
                      icon: Icons.history_outlined,
                      title: 'LICH SU',
                      subtitle: 'Giao dich',
                      onTap: widget.onOpenHistory,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _QuickActionCard(
                      icon: Icons.storefront_outlined,
                      title: 'UU DAI',
                      subtitle: 'Thanh vien',
                      onTap: widget.onOpenRewards,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Trang Thai Ban',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 22,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        SizedBox(height: 4),
                        Text(
                          'Cap nhat tinh trang ban theo thoi gian thuc',
                          style: TextStyle(color: Color(0xFF92A0A9)),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFF163228),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      '$availableCount DANG TRONG',
                      style: const TextStyle(
                        color: Color(0xFF9EF9B7),
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: tableCards.length,
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  mainAxisSpacing: 14,
                  crossAxisSpacing: 14,
                  childAspectRatio: 0.82,
                ),
                itemBuilder: (context, index) {
                  final table = tableCards[index];
                  final isFree = table.isAvailable;
                  final accent = table.isVip
                      ? const Color(0xFFFFC933)
                      : isFree
                      ? const Color(0xFF9EF9B7)
                      : const Color(0xFFE96D6D);
                  return Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: _tableCardColor(table),
                      borderRadius: BorderRadius.circular(28),
                      border: table.isVip
                          ? Border.all(color: const Color(0x66FFC933))
                          : null,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              table.isVip ? 'VIP' : 'B${table.tableNumber}',
                              style: TextStyle(
                                color: accent,
                                fontSize: 24,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                            const Spacer(),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 5,
                              ),
                              decoration: BoxDecoration(
                                color: accent.withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Text(
                                labelTableStatus(table.status).toUpperCase(),
                                style: TextStyle(
                                  color: accent,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 18),
                        const Text(
                          'TRANG THAI',
                          style: TextStyle(
                            color: Color(0xFF93A0A8),
                            letterSpacing: 1,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          labelTableStatus(table.status),
                          style: TextStyle(
                            color: isFree ? Colors.white : const Color(0xFFB3BEC6),
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const Spacer(),
                        SizedBox(
                          width: double.infinity,
                          child: FilledButton(
                            onPressed: isFree ? widget.onOpenBooking : null,
                            style: FilledButton.styleFrom(
                              backgroundColor: isFree
                                  ? (table.isVip
                                        ? const Color(0xFFFFC933)
                                        : const Color(0xFF243A34))
                                  : const Color(0xFF1A2630),
                              foregroundColor: isFree
                                  ? (table.isVip
                                        ? const Color(0xFF2F2500)
                                        : const Color(0xFF9EF9B7))
                                  : const Color(0xFF73828C),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(18),
                              ),
                            ),
                            child: Text(isFree ? 'DAT NGAY' : 'DANG BAN'),
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
              const SizedBox(height: 18),
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: const Color(0xFF121F28),
                  borderRadius: BorderRadius.circular(30),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Khuyen Mai Gio Vang',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 26,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            'Giam 50% do uong tu 14:00 den 16:00 moi ngay.',
                            style: TextStyle(color: Color(0xFFA0ADB5)),
                          ),
                          const SizedBox(height: 18),
                          FilledButton(
                            onPressed: widget.onOpenMenu,
                            style: FilledButton.styleFrom(
                              backgroundColor: const Color(0xFF9EF9B7),
                              foregroundColor: const Color(0xFF153126),
                            ),
                            child: const Text('GOI MON NGAY'),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    const Icon(
                      Icons.local_cafe_outlined,
                      size: 88,
                      color: Color(0x66FFFFFF),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _ActiveSessionCard extends StatelessWidget {
  const _ActiveSessionCard({
    required this.activeSession,
    required this.onOpenMenu,
  });

  final ActiveSessionData activeSession;
  final VoidCallback onOpenMenu;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF101C25),
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: const Color(0xFF22313A)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Ban hien tai dang choi',
                  style: TextStyle(
                    color: Color(0xFF9EF9B7),
                    fontSize: 12,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 0.8,
                  ),
                ),
              ),
              Container(
                width: 8,
                height: 8,
                decoration: const BoxDecoration(
                  color: Color(0xFF0CC38C),
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                'Ban ${activeSession.tableNumber.toString().padLeft(2, '0')}',
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            formatCurrency(activeSession.estimatedTotal),
            style: const TextStyle(
              color: Colors.white,
              fontSize: 32,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '${activeSession.minutes} phut | Giam gia ${activeSession.discountPct.toStringAsFixed(0)}%',
            style: const TextStyle(color: Color(0xFF9AA9B0)),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: _SessionInfoChip(
                  label: 'Trang thai',
                  value: 'Dang choi',
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _SessionInfoChip(
                  label: 'Tam tinh',
                  value: formatCurrency(activeSession.estimatedTotal),
                  highlight: true,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: onOpenMenu,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF9EF9B7),
                foregroundColor: const Color(0xFF153126),
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(18),
                ),
              ),
              child: const Text(
                'Xem thuc don / Goi mon',
                style: TextStyle(fontWeight: FontWeight.w900),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SessionInfoChip extends StatelessWidget {
  const _SessionInfoChip({
    required this.label,
    required this.value,
    this.highlight = false,
  });

  final String label;
  final String value;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF151F27),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              color: Color(0xFF90A0A8),
              fontSize: 11,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: TextStyle(
              color: highlight ? const Color(0xFF9EF9B7) : Colors.white,
              fontSize: 15,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}

