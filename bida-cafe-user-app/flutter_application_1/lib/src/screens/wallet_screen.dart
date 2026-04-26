part of '../app.dart';

class _WalletPage extends StatefulWidget {
  const _WalletPage({
    required this.api,
    required this.token,
    required this.refreshSignal,
  });

  final ApiClient api;
  final String token;
  final int refreshSignal;

  @override
  State<_WalletPage> createState() => _WalletPageState();
}

class _WalletPageState extends State<_WalletPage> {
  late Future<WalletData> _future;
  final TextEditingController _customAmountController = TextEditingController();

  @override
  void dispose() {
    _customAmountController.dispose();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    _future = widget.api.fetchWallet(widget.token);
  }

  @override
  void didUpdateWidget(covariant _WalletPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.refreshSignal != widget.refreshSignal) {
      _reload();
    }
  }

  Future<void> _reload() async {
    final nextFuture = widget.api.fetchWallet(widget.token);
    setState(() {
      _future = nextFuture;
    });
    await nextFuture;
  }

  Future<void> _requestTopup(double amount) async {
    if (amount <= 0) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('So tien nap phai lon hon 0.')),
      );
      return;
    }
    try {
      await widget.api.post(
        '/topup-requests',
        token: widget.token,
        body: {
          'amount': amount,
          'paymentMethod': 'BANK_TRANSFER',
          'note': 'Nap tu Flutter app',
        },
      );
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Da tao yeu cau nap ${formatCurrency(amount)}')),
      );
      await _reload();
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<WalletData>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError) {
          return _ErrorState(message: snapshot.error.toString());
        }
        final wallet = snapshot.data!;
        return RefreshIndicator(
          onRefresh: _reload,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
            children: [
              _HeroCard(
                eyebrow: 'So du kha dung',
                title: formatCurrency(wallet.walletBalance),
                subtitle:
                    'Tong da nap ${formatCurrency(wallet.totalDeposited)}',
              ),
              const SizedBox(height: 14),
              _SectionCard(
                title: 'Nap nhanh',
                child: Row(
                  children: [
                    Expanded(
                      child: _TopupButton(
                        label: '200.000',
                        onTap: () => _requestTopup(200000),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _TopupButton(
                        label: '500.000',
                        onTap: () => _requestTopup(500000),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _TopupButton(
                        label: '1.000.000',
                        onTap: () => _requestTopup(1000000),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              _SectionCard(
                title: 'Nap so tien tuy chon',
                child: Column(
                  children: [
                    _AppField(
                      controller: _customAmountController,
                      label: 'Nhap so tien can nap',
                      icon: Icons.payments_outlined,
                      keyboardType: TextInputType.number,
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: () {
                          final sanitized = _customAmountController.text
                              .replaceAll('.', '')
                              .replaceAll(',', '')
                              .trim();
                          final amount = double.tryParse(sanitized) ?? 0;
                          _requestTopup(amount);
                        },
                        icon: const Icon(Icons.add_card_outlined),
                        label: const Text('Gui yeu cau nap'),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              _SectionCard(
                title: 'Lich su nap tien',
                child: wallet.recentDeposits.isEmpty
                    ? const Text('Chua co giao dich nap tien.')
                    : Column(
                        children: wallet.recentDeposits.map((item) {
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: Row(
                              children: [
                                const CircleAvatar(
                                  radius: 18,
                                  backgroundColor: Color(0xFFE5FBF3),
                                  child: Icon(
                                    Icons.arrow_downward_rounded,
                                    color: Color(0xFF0A8F78),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        item.paymentMethod,
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                      Text(formatDate(item.createdAt)),
                                    ],
                                  ),
                                ),
                                Text(
                                  formatCurrency(item.amount),
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ],
                            ),
                          );
                        }).toList(),
                      ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _MenuCard extends StatefulWidget {
  const _MenuCard({required this.api, required this.token, required this.item});

  final ApiClient api;
  final String token;
  final ProductInfo item;

  @override
  State<_MenuCard> createState() => _MenuCardState();
}

class _MenuCardState extends State<_MenuCard> {
  bool _ordering = false;

  Future<void> _order() async {
    setState(() => _ordering = true);
    try {
      final result = await widget.api.post(
        '/orders',
        token: widget.token,
        body: {'productId': widget.item.productId, 'quantity': 1},
      );
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Da goi ${widget.item.productName}: ${formatCurrency(toDouble(result['final_total']))}',
          ),
        ),
      );
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    } finally {
      if (mounted) {
        setState(() => _ordering = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            height: 150,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(18),
              gradient: const LinearGradient(
                colors: [Color(0xFF13352E), Color(0xFF69E0C2)],
              ),
            ),
            child: Center(
              child: Text(
                widget.item.productName,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            widget.item.productName,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 4),
          Text(
            widget.item.category,
            style: const TextStyle(color: Color(0xFF5B7A73)),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Text(
                formatCurrency(widget.item.price),
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const Spacer(),
              FilledButton(
                onPressed: _ordering ? null : _order,
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF0CC38C),
                ),
                child: Text(_ordering ? 'Dang gui...' : 'Goi mon'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

