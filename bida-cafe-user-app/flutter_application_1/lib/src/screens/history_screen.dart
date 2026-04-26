part of '../app.dart';

class _HistoryPage extends StatefulWidget {
  const _HistoryPage({required this.api, required this.token});

  final ApiClient api;
  final String token;

  @override
  State<_HistoryPage> createState() => _HistoryPageState();
}

class _HistoryPageState extends State<_HistoryPage> {
  late Future<List<OrderHistoryItem>> _future;

  @override
  void initState() {
    super.initState();
    _future = widget.api.fetchHistory(widget.token);
  }

  Future<void> _reload() async {
    final nextFuture = widget.api.fetchHistory(widget.token);
    setState(() {
      _future = nextFuture;
    });
    await nextFuture;
  }

  Future<void> _openOrderDetail(OrderHistoryItem item) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => Scaffold(
          appBar: AppBar(title: Text('Don #${item.orderId}')),
          body: _OrderDetailPage(
            api: widget.api,
            token: widget.token,
            orderId: item.orderId,
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<OrderHistoryItem>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError) {
          return _ErrorState(message: snapshot.error.toString());
        }
        final items = snapshot.data!;

        return RefreshIndicator(
          onRefresh: _reload,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
            children: [
              _HeroCard(
                eyebrow: 'Lich su don hang',
                title: '${items.length} giao dich',
                subtitle: 'Xem ngay don vua gui tu menu.',
              ),
              const SizedBox(height: 14),
              if (items.isEmpty)
                const _SectionCard(
                  title: 'History',
                  child: Text('Chua co don hang nao.'),
                )
              else
                ...items.map((item) {
                  final statusColor = item.status == 'DONE'
                      ? const Color(0xFF0A7F6D)
                      : const Color(0xFFC07B1D);
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Material(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      child: InkWell(
                        onTap: () => _openOrderDetail(item),
                        borderRadius: BorderRadius.circular(20),
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Row(
                            children: [
                              CircleAvatar(
                                radius: 22,
                                backgroundColor: statusColor.withValues(
                                  alpha: 0.12,
                                ),
                                child: Icon(
                                  item.orderType == 'CAFE'
                                      ? Icons.local_cafe_outlined
                                      : Icons.receipt_long_outlined,
                                  color: statusColor,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      '${labelOrderType(item.orderType)} #${item.orderId}',
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w800,
                                        fontSize: 16,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(formatDate(item.createdAt)),
                                    const SizedBox(height: 4),
                                    const Text(
                                      'Cham de xem chi tiet',
                                      style: TextStyle(
                                        color: Color(0xFF68817B),
                                        fontSize: 12,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Text(
                                    formatCurrency(item.totalAmount),
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w900,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    labelOrderStatus(item.status),
                                    style: TextStyle(
                                      color: statusColor,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  );
                }),
            ],
          ),
        );
      },
    );
  }
}
