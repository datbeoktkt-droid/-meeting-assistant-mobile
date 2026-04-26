part of '../app.dart';

class _OrderDetailPage extends StatefulWidget {
  const _OrderDetailPage({
    required this.api,
    required this.token,
    required this.orderId,
  });

  final ApiClient api;
  final String token;
  final int orderId;

  @override
  State<_OrderDetailPage> createState() => _OrderDetailPageState();
}

class _OrderDetailPageState extends State<_OrderDetailPage> {
  late Future<OrderDetail> _future;

  @override
  void initState() {
    super.initState();
    _future = widget.api.fetchHistoryDetail(widget.token, widget.orderId);
  }

  Future<void> _reload() async {
    final nextFuture = widget.api.fetchHistoryDetail(
      widget.token,
      widget.orderId,
    );
    setState(() {
      _future = nextFuture;
    });
    await nextFuture;
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<OrderDetail>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError) {
          return _ErrorState(message: snapshot.error.toString());
        }
        final detail = snapshot.data!;
        return RefreshIndicator(
          onRefresh: _reload,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
            children: [
              _HeroCard(
                eyebrow: 'Chi tiet don hang',
                title: '${labelOrderType(detail.orderType)} #${detail.orderId}',
                subtitle:
                    '${labelOrderStatus(detail.status)} | ${formatDate(detail.createdAt)}',
              ),
              const SizedBox(height: 14),
              _SectionCard(
                title: 'Chi tiet mon',
                child: Column(
                  children: detail.items.isEmpty
                      ? const [Text('Don nay chua co chi tiet mon.')]
                      : detail.items.map((item) {
                          final qtyText = item.quantity % 1 == 0
                              ? item.quantity.toStringAsFixed(0)
                              : item.quantity.toStringAsFixed(1);
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        item.productName,
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w800,
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        '$qtyText x ${formatCurrency(item.unitPrice)}',
                                        style: const TextStyle(
                                          color: Color(0xFF68817B),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Text(
                                  formatCurrency(item.lineTotal),
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                              ],
                            ),
                          );
                        }).toList(),
                ),
              ),
              const SizedBox(height: 14),
              _SectionCard(
                title: 'Tong cong',
                child: _BenefitRow(
                  label: 'Thanh tien',
                  value: formatCurrency(detail.totalAmount),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
