part of '../app.dart';

class _MenuPage extends StatefulWidget {
  const _MenuPage({
    required this.api,
    required this.token,
    required this.refreshSignal,
  });

  final ApiClient api;
  final String token;
  final int refreshSignal;

  @override
  State<_MenuPage> createState() => _MenuPageState();
}

class _MenuPageState extends State<_MenuPage> {
  late Future<List<dynamic>> _future;
  final Map<int, int> _quantities = {};
  String _selectedCategory = 'Tat ca';
  bool _submittingTray = false;
  String _paymentMethod = 'CASH';
  int? _activeTableId;
  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    // Load initial data and set activeTableId from results
    _future = _loadData().then((data) {
      if (mounted && data.length >= 2) {
        final home = data[1] as HomeBundle;
        setState(() {
          _activeTableId = home.activeSession?.tableId;
        });
      }
      return data;
    });
    _refreshTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted) _reload();
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant _MenuPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.refreshSignal != widget.refreshSignal) {
      _reload();
    }
  }

  Future<List<dynamic>> _loadData() {
    return Future.wait<dynamic>([
      widget.api.fetchMenu(widget.token),
      widget.api.fetchHome(widget.token),
    ]);
  }

  Future<void> _reload() async {
    final nextFuture = _loadData();
    setState(() {
      _future = nextFuture;
    });
    final data = await nextFuture;
    if (mounted && data.length >= 2) {
      final home = data[1] as HomeBundle;
      setState(() {
        _activeTableId = home.activeSession?.tableId;
      });
    }
  }

  void _changeQty(ProductInfo item, int delta) {
    final current = _quantities[item.productId] ?? 0;
    final next = current + delta;
    setState(() {
      if (next <= 0) {
        _quantities.remove(item.productId);
      } else {
        _quantities[item.productId] = next;
      }
    });
  }

  Future<void> _submitTray() async {
    if (_quantities.isEmpty) {
      return;
    }
    try {
      var total = 0.0;
      var itemCount = 0;
      for (final entry in _quantities.entries) {
        final result = await widget.api.post(
          '/orders',
          token: widget.token,
          body: {
            'productId': entry.key,
            'quantity': entry.value,
            'paymentMethod': _paymentMethod,
            if (_activeTableId != null) 'tableId': _activeTableId,
          },
        );
        total += toDouble(result['final_total']);
        itemCount += entry.value;
      }

      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Da gui $itemCount mon vao ban, tong ${formatCurrency(total)}',
          ),
        ),
      );
      setState(() {
        _quantities.clear();
      });
      await _reload();
      if (mounted) {
        // Only pop once, and ensure it's the right context
        Navigator.of(context).popUntil((route) => route.isFirst); 
      }
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    } finally {
      if (mounted) {
        setState(() {
          _submittingTray = false;
        });
      }
    }
  }

  // ==========================================================================
  // [GHI CHU]: HAM GUI YEU CAU THANH TOAN DEN ADMIN
  // Neu bam nut bi loi, hay kiem tra duong dan '/request-staff-checkout' co dung khong.
  // ==========================================================================
  Future<void> _requestPayment() async {
    try {
      final data = await _future;
      final home = data?[1] as HomeBundle?;
      
      await widget.api.post(
        '/request-staff-checkout',
        body: {
          'userId': home?.user.userId,
          'userName': home?.user.fullName,
          'tableNumber': home?.activeSession?.tableNumber,
        },
        token: widget.token,
      );
      
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Da gui yeu cau thanh toan. Vui long doi nhan vien den ban.'),
          backgroundColor: Colors.green,
        ),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      // [GHI CHU]: In loi chi tiet ra de biet tai sao may chu tra ve HTML
      print('LOI GOI NHAN VIEN: ${e.message}');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Loi ket noi: ${e.message.substring(0, math.min(e.message.length, 50))}...'), 
          backgroundColor: Colors.red
        ),
      );
    }
  }
  // ==========================================================================

  Future<void> _showInvoiceDialog() async {
    try {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Goi thanh toan'),
          content: const Text('Ban muon goi nhan vien den ban de thanh toan?'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Huy'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              style: FilledButton.styleFrom(backgroundColor: const Color(0xFF0CC38C)),
              child: const Text('Gui yeu cau'),
            ),
          ],
        ),
      );

      if (confirmed == true) {
        await _requestPayment();
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Loi: ${e.toString()}')),
      );
    }
  }

  Widget _buildInvoiceSection({
    required String title,
    required IconData icon,
    required List<Widget> children,
  }) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFE8F2EF)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 18, color: const Color(0xFF0A7F6D)),
              const SizedBox(width: 10),
              Text(
                title,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF0A7F6D),
                  letterSpacing: 0.5,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          ...children,
        ],
      ),
    );
  }


  Future<void> _doCheckout(String method) async {
    try {
      final res = await widget.api.post(
        '/sessions/active/checkout',
        token: widget.token,
        body: {'paymentMethod': method},
      );
      if (!mounted) return;
      final total = res['grand_total'];
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Da thanh toan xong! Tong: ${formatCurrency(toDouble(total))}')),
      );
      await _reload();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message)),
      );
    }
  }

  Future<void> _openTray(List<ProductInfo> items, double trayTotal) async {
    if (_quantities.isEmpty) {
      return;
    }

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (context) {
        final selectedItems = items
            .where((item) => (_quantities[item.productId] ?? 0) > 0)
            .toList();
        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
          child: SafeArea(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'Khay don hang',
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.close),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Flexible(
                  child: ListView.separated(
                    shrinkWrap: true,
                    itemCount: selectedItems.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final item = selectedItems[index];
                      final qty = _quantities[item.productId] ?? 0;
                      return Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF6F9F8),
                          borderRadius: BorderRadius.circular(18),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    item.productName,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    '${qty} x ${formatCurrency(item.price)}',
                                  ),
                                ],
                              ),
                            ),
                            Text(
                              formatCurrency(item.price * qty),
                              style: const TextStyle(
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    // Payment method selection removed - all orders go to session bill
                    const SizedBox(width: 12),
                    Expanded(
                      child: FilledButton(
                        onPressed: _submittingTray
                            ? null
                            : () async {
                                await _submitTray();
                              },
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFF0CC38C),
                        ),
                        child: Text(
                          _submittingTray
                              ? 'Dang gui...'
                              : 'Gui mon vao ban (${formatCurrency(trayTotal)})',
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<dynamic>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError) {
          return _ErrorState(message: snapshot.error.toString());
        }

        final items = snapshot.data![0] as List<ProductInfo>;
        final home = snapshot.data![1] as HomeBundle;
        
        final categories = <String>{
          'Tat ca',
          ...items.map((item) => item.category),
        }.toList();
        if (!categories.contains(_selectedCategory)) {
          _selectedCategory = 'Tat ca';
        }

        final filteredItems = _selectedCategory == 'Tat ca'
            ? items
            : items
                  .where((item) => item.category == _selectedCategory)
                  .toList();
        final trayCount = _quantities.values.fold<int>(
          0,
          (sum, item) => sum + item,
        );
        final trayTotal = items.fold<double>(0, (sum, item) {
          final qty = _quantities[item.productId] ?? 0;
          return sum + item.price * qty;
        });

        return RefreshIndicator(
          onRefresh: _reload,
          child: Stack(
            children: [
              ListView(
                padding: EdgeInsets.fromLTRB(
                  20,
                  8,
                  20,
                  trayCount > 0 ? 130 : 28,
                ),
                children: [
                  _MenuHeaderCard(
                    activeSession: home.activeSession,
                    walletBalance: home.user.walletBalance,
                    onCheckout: home.activeSession != null ? _showInvoiceDialog : null,
                  ),
                  const SizedBox(height: 14),
                  SizedBox(
                    height: 44,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: categories.length,
                      separatorBuilder: (_, _) => const SizedBox(width: 10),
                      itemBuilder: (context, index) {
                        final category = categories[index];
                        final isSelected = category == _selectedCategory;
                        return ChoiceChip(
                          label: Text(category),
                          selected: isSelected,
                          onSelected: (_) {
                            setState(() {
                              _selectedCategory = category;
                            });
                          },
                          selectedColor: const Color(0xFF0A7F6D),
                          labelStyle: TextStyle(
                            color: isSelected
                                ? Colors.white
                                : const Color(0xFF4D625D),
                            fontWeight: FontWeight.w700,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: 18),
                  Row(
                    children: const [
                      Expanded(
                        child: Text(
                          'Dang duoc goi nhieu',
                          style: TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                      Text(
                        'NOI BAT',
                        style: TextStyle(
                          color: Color(0xFF0A7F6D),
                          fontSize: 12,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.8,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  ...filteredItems.map((item) {
                    final qty = _quantities[item.productId] ?? 0;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 14),
                      child: _MenuProductCard(
                        item: item,
                        quantity: qty,
                        onAdd: () => _changeQty(item, 1),
                        onRemove: () => _changeQty(item, -1),
                      ),
                    );
                  }),
                ],
              ),
              if (trayCount > 0)
                Positioned(
                  left: 20,
                  right: 20,
                  bottom: 18,
                  child: _OrderTrayBar(
                    itemCount: trayCount,
                    orderTotal: trayTotal,
                    submitting: _submittingTray,
                    onViewTray: () => _openTray(items, trayTotal),
                    onSubmit: _submittingTray ? null : _submitTray,
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}

class _MenuHeaderCard extends StatelessWidget {
  const _MenuHeaderCard({
    required this.activeSession,
    required this.walletBalance,
    this.onCheckout,
  });

  final ActiveSessionData? activeSession;
  final double walletBalance;
  final VoidCallback? onCheckout;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(26),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const CircleAvatar(
                radius: 18,
                backgroundColor: Color(0xFF24463F),
                child: Icon(Icons.person, color: Colors.white),
              ),
              const SizedBox(width: 12),
                    const Expanded(
                      child: Text(
                        'Bida & Coffee 82',
                        style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
                      ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F6F4),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Text(
                  formatCurrency(walletBalance),
                  style: const TextStyle(
                    color: Color(0xFF0A7F6D),
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: const Color(0xFFF7F9F8),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'BAN HIEN TAI',
                        style: TextStyle(
                          color: Color(0xFF7F9690),
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.8,
                        ),
                      ),
                    ),
                    Container(
                      height: 8,
                      width: 8,
                      decoration: const BoxDecoration(
                        color: Color(0xFF0CC38C),
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 6),
                    const Text(
                      'DANG CHOI',
                      style: TextStyle(
                        color: Color(0xFF0A7F6D),
                        fontSize: 11,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Text(
                  activeSession == null
                      ? 'Chua co ban dang choi'
                      : 'Ban ${activeSession!.tableNumber.toString().padLeft(2, '0')}',
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: _SessionStat(
                        label: 'Thoi gian',
                        value: activeSession == null
                            ? '--'
                            : '${activeSession!.minutes} phut',
                      ),
                    ),
                    Expanded(
                      child: _SessionStat(
                        label: 'Tam tinh',
                        value: activeSession == null
                            ? '--'
                            : formatCurrency(activeSession!.estimatedTotal),
                        highlight: true,
                      ),
                    ),
                  ],
                ),
                if (activeSession != null) ...[
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton(
                      onPressed: onCheckout,
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF0A7F6D),
                        side: const BorderSide(color: Color(0xFF0A7F6D)),
                      ),
                      child: const Text('Xem hoa don / Goi thanh toan'),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SessionStat extends StatelessWidget {
  const _SessionStat({
    required this.label,
    required this.value,
    this.highlight = false,
  });

  final String label;
  final String value;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(color: Color(0xFF859A95), fontSize: 12),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: TextStyle(
            fontWeight: FontWeight.w900,
            fontSize: 18,
            color: highlight
                ? const Color(0xFF0A7F6D)
                : const Color(0xFF283533),
          ),
        ),
      ],
    );
  }
}

class _MenuProductCard extends StatelessWidget {
  const _MenuProductCard({
    required this.item,
    required this.quantity,
    required this.onAdd,
    required this.onRemove,
  });

  final ProductInfo item;
  final int quantity;
  final VoidCallback onAdd;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _MenuProductImage(item: item),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        item.productName,
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                    Text(
                      formatCurrency(item.price),
                      style: const TextStyle(
                        color: Color(0xFF0A7F6D),
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  item.category,
                  style: const TextStyle(color: Color(0xFF68817B)),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    _QtyButton(
                      icon: Icons.remove,
                      onTap: quantity > 0 ? onRemove : null,
                    ),
                    Container(
                      width: 48,
                      alignment: Alignment.center,
                      child: Text(
                        '$quantity',
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                    _QtyButton(icon: Icons.add, onTap: onAdd),
                    const Spacer(),
                    FilledButton(
                      onPressed: onAdd,
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFF0CC38C),
                      ),
                      child: Text(quantity > 0 ? 'Them' : 'Chon'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MenuProductImage extends StatelessWidget {
  const _MenuProductImage({required this.item});

  final ProductInfo item;

  @override
  Widget build(BuildContext context) {
    var imageUrl = item.imageUrl;
    if (imageUrl != null && imageUrl.isNotEmpty && !imageUrl.startsWith('http')) {
      imageUrl = '${ApiConfig.baseUrl}$imageUrl';
    }
    return Container(
      height: 220,
      decoration: const BoxDecoration(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        gradient: LinearGradient(
          colors: [Color(0xFF081F19), Color(0xFF6FDBBE)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (imageUrl != null && imageUrl.isNotEmpty)
            ClipRRect(
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(24),
              ),
              child: Image.network(
                imageUrl,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => const SizedBox.shrink(),
              ),
            ),
          Container(
            decoration: BoxDecoration(
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(24),
              ),
              gradient: LinearGradient(
                colors: [
                  Colors.black.withOpacity(
                    imageUrl != null && imageUrl.isNotEmpty ? 0.18 : 0,
                  ),
                  Colors.black.withOpacity(0.28),
                ],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
              ),
            ),
          ),
          Positioned(
            left: 14,
            top: 14,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFF0A7F6D),
                borderRadius: BorderRadius.circular(999),
              ),
              child: const Text(
                'NOI BAT',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 11,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 0.8,
                ),
              ),
            ),
          ),
          Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Text(
                item.productName,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 28,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _QtyButton extends StatelessWidget {
  const _QtyButton({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Ink(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: onTap == null
              ? const Color(0xFFF1F3F2)
              : const Color(0xFFE6FBF4),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(icon, color: const Color(0xFF0A7F6D)),
      ),
    );
  }
}

class _OrderTrayBar extends StatelessWidget {
  const _OrderTrayBar({
    required this.itemCount,
    required this.orderTotal,
    required this.submitting,
    required this.onViewTray,
    required this.onSubmit,
  });

  final int itemCount;
  final double orderTotal;
  final bool submitting;
  final VoidCallback onViewTray;
  final VoidCallback? onSubmit;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        gradient: const LinearGradient(
          colors: [Color(0xFF1B9A82), Color(0xFF57D9BB)],
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x331B9A82),
            blurRadius: 18,
            offset: Offset(0, 10),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            height: 42,
            width: 42,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.22),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Text(
              '$itemCount',
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w900,
                fontSize: 18,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: InkWell(
              onTap: onViewTray,
              borderRadius: BorderRadius.circular(16),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'SO MON DA CHON',
                      style: TextStyle(
                        color: Colors.white70,
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.8,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Xem khay don',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                        fontSize: 18,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              const Text(
                'TONG DON',
                style: TextStyle(
                  color: Colors.white70,
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.8,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                formatCurrency(orderTotal),
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                  fontSize: 18,
                ),
              ),
            ],
          ),
          const SizedBox(width: 10),
          FilledButton(
            onPressed: onSubmit,
            style: FilledButton.styleFrom(
              backgroundColor: Colors.white,
              foregroundColor: const Color(0xFF0A7F6D),
            ),
            child: Text(submitting ? '...' : 'Gui'),
          ),
        ],
      ),
    );
  }
}

class _InvoiceRow extends StatelessWidget {
  const _InvoiceRow({
    required this.label,
    required this.value,
    this.isDiscount = false,
    this.isBold = false,
    this.color,
  });

  final String label;
  final String value;
  final bool isDiscount;
  final bool isBold;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: isBold ? 16 : 14,
              fontWeight: isBold ? FontWeight.w900 : FontWeight.w600,
              color: color ?? (isDiscount ? const Color(0xFFE63946) : const Color(0xFF4D625D)),
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: isBold ? 16 : 14,
              fontWeight: isBold ? FontWeight.w900 : FontWeight.w700,
              color: color ?? (isDiscount ? const Color(0xFFE63946) : const Color(0xFF1B4332)),
            ),
          ),
        ],
      ),
    );
  }
}

class _PaymentMethodCard extends StatelessWidget {
  const _PaymentMethodCard({
    required this.label,
    required this.icon,
    required this.isSelected,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFFE6FBF4) : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? const Color(0xFF0CC38C) : const Color(0xFFE8F2EF),
            width: 2,
          ),
        ),
        child: Column(
          children: [
            Icon(
              icon,
              color: isSelected ? const Color(0xFF0A7F6D) : const Color(0xFF7F9690),
            ),
            const SizedBox(height: 8),
            Text(
              label,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w800,
                color: isSelected ? const Color(0xFF0A7F6D) : const Color(0xFF4D625D),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

