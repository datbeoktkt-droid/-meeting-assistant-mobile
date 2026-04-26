part of '../app.dart';

class _RewardsPage extends StatefulWidget {
  const _RewardsPage({required this.api, required this.token});

  final ApiClient api;
  final String token;

  @override
  State<_RewardsPage> createState() => _RewardsPageState();
}

class _RewardsPageState extends State<_RewardsPage> {
  late Future<MembershipData> _future;

  @override
  void initState() {
    super.initState();
    _future = widget.api.fetchMembership(widget.token);
  }

  Future<void> _reload() async {
    final nextFuture = widget.api.fetchMembership(widget.token);
    setState(() {
      _future = nextFuture;
    });
    await nextFuture;
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<MembershipData>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError) {
          return _ErrorState(message: snapshot.error.toString());
        }
        final membership = snapshot.data!;
        final remaining = membership.nextThreshold == null
            ? 0
            : (membership.nextThreshold! - membership.totalDeposited).clamp(
                0,
                double.infinity,
              );
        return RefreshIndicator(
          onRefresh: _reload,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
            children: [
              _HeroCard(
                eyebrow: 'Hang thanh vien',
                title: membership.currentRankName,
                subtitle:
                    'Tich luy ${formatCurrency(membership.totalDeposited)}',
              ),
              const SizedBox(height: 14),
              _SectionCard(
                title: 'Uu dai hien tai',
                child: Column(
                  children: [
                    _BenefitRow(
                      label: 'Giam gia do uong',
                      value:
                          '${membership.discountCafePct.toStringAsFixed(0)}%',
                    ),
                    const SizedBox(height: 12),
                    _BenefitRow(
                      label: 'Giam gia tien ban',
                      value:
                          '${membership.discountBilliardPct.toStringAsFixed(0)}%',
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              _SectionCard(
                title: 'Moc tiep theo',
                child: Text(
                  membership.nextRankName == null
                      ? 'Ban da o muc cao nhat.'
                      : 'Can them ${formatCurrency(remaining)} de len ${membership.nextRankName}.',
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
