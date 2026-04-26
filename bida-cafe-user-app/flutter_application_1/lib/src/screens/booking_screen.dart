part of '../app.dart';

class _BookingPage extends StatefulWidget {
  const _BookingPage({
    required this.api,
    required this.token,
    required this.refreshSignal,
  });

  final ApiClient api;
  final String token;
  final int refreshSignal;

  @override
  State<_BookingPage> createState() => _BookingPageState();
}

class _BookingPageState extends State<_BookingPage> {
  late Future<List<dynamic>> _future;

  Color _statusColor(String status) {
    switch (status.toUpperCase()) {
      case 'AVAILABLE':
        return const Color(0xFF0A8F78);
      case 'RESERVED':
        return const Color(0xFFC07B1D);
      case 'ACTIVE':
      case 'IN_USE':
        return const Color(0xFF425CFF);
      case 'CLEANING':
        return const Color(0xFF8A5B2E);
      default:
        return const Color(0xFF68817B);
    }
  }

  @override
  void initState() {
    super.initState();
    _future = _loadData();
  }

  @override
  void didUpdateWidget(covariant _BookingPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.refreshSignal != widget.refreshSignal) {
      _reload();
    }
  }

  Future<List<dynamic>> _loadData() {
    return Future.wait<dynamic>([
      widget.api.fetchTables(widget.token),
      widget.api.fetchBookings(widget.token),
    ]);
  }

  Future<void> _reload() async {
    final nextFuture = _loadData();
    setState(() {
      _future = nextFuture;
    });
    await nextFuture;
  }

  Future<void> _openBookingSheet(List<TableInfo> tables) async {
    final availableTables = tables.where((item) => item.isAvailable).toList();
    if (availableTables.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Hien khong con ban trong de dat.')),
      );
      return;
    }

    final result = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _BookingFormSheet(
        api: widget.api,
        token: widget.token,
        tables: availableTables,
      ),
    );

    if (result == true && mounted) {
      await _reload();
    }
  }

  Future<void> _cancelBooking(BookingInfo booking) async {
    try {
      await widget.api.cancelBooking(
        token: widget.token,
        bookingId: booking.bookingId,
      );
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Da huy booking ban ${booking.tableNumber}.')),
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

  Future<void> _extendBooking(BookingInfo booking, int extraMinutes) async {
    try {
      await widget.api.extendBooking(
        token: widget.token,
        bookingId: booking.bookingId,
        extraMinutes: extraMinutes,
      );
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Da gia han booking ban ${booking.tableNumber} them $extraMinutes phut.',
          ),
        ),
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
    return FutureBuilder<List<dynamic>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError) {
          return _ErrorState(message: snapshot.error.toString());
        }

        final tables = snapshot.data![0] as List<TableInfo>;
        final bookings = snapshot.data![1] as List<BookingInfo>;
        final availableTables = tables.where((item) => item.isAvailable).length;

        return RefreshIndicator(
          onRefresh: _reload,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
            children: [
              _HeroCard(
                eyebrow: 'Dat ban',
                title: '$availableTables ban trong',
                subtitle: 'Dat ban truoc de test luong booking.',
              ),
              const SizedBox(height: 14),
              FilledButton.icon(
                onPressed: () => _openBookingSheet(tables),
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF0CC38C),
                  minimumSize: const Size.fromHeight(52),
                ),
                icon: const Icon(Icons.add_circle_outline),
                label: const Text('Dat ban ngay'),
              ),
              const SizedBox(height: 14),
              _SectionCard(
                title: 'Danh sach ban',
                child: Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: tables.map((table) {
                    final statusColor = _statusColor(table.status);
                    return Container(
                      width: 96,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: statusColor.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(18),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'B${table.tableNumber}',
                            style: const TextStyle(fontWeight: FontWeight.w800),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            labelTableStatus(table.status),
                            style: TextStyle(
                              fontSize: 12,
                              color: statusColor,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          if (table.isVip)
                            Padding(
                              padding: const EdgeInsets.only(top: 4),
                              child: Text(
                                'VIP',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: statusColor,
                                ),
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
                title: 'Lich da dat',
                child: bookings.isEmpty
                    ? const Text('Chua co booking nao.')
                    : Column(
                        children: bookings.map((booking) {
                          final statusColor = _statusColor(booking.status);
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: Container(
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF6F8F8),
                                borderRadius: BorderRadius.circular(18),
                              ),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const CircleAvatar(
                                    backgroundColor: Color(0xFFE5FBF3),
                                    child: Icon(
                                      Icons.event_available_outlined,
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
                                          'Ban ${booking.tableNumber}',
                                          style: const TextStyle(
                                            fontWeight: FontWeight.w800,
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          '${formatDate(booking.bookingStart)} - ${formatDate(booking.bookingEnd)}',
                                        ),
                                        const SizedBox(height: 4),
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 10,
                                            vertical: 4,
                                          ),
                                          decoration: BoxDecoration(
                                            color: statusColor.withValues(
                                              alpha: 0.12,
                                            ),
                                            borderRadius: BorderRadius.circular(
                                              999,
                                            ),
                                          ),
                                          child: Text(
                                            labelTableStatus(booking.status),
                                            style: TextStyle(
                                              color: statusColor,
                                              fontWeight: FontWeight.w800,
                                              fontSize: 12,
                                            ),
                                          ),
                                        ),
                                        if (booking.notes != null &&
                                            booking.notes!.trim().isNotEmpty) ...[
                                          const SizedBox(height: 6),
                                          Text(
                                            booking.notes!,
                                            style: const TextStyle(
                                              color: Color(0xFF68817B),
                                              fontSize: 12,
                                            ),
                                          ),
                                        ],
                                      ],
                                    ),
                                  ),
                                  if (booking.canCancel)
                                    Column(
                                      children: [
                                        TextButton(
                                          onPressed: () =>
                                              _extendBooking(booking, 30),
                                          child: const Text('+30p'),
                                        ),
                                        TextButton(
                                          onPressed: () =>
                                              _extendBooking(booking, 60),
                                          child: const Text('+60p'),
                                        ),
                                        TextButton(
                                          onPressed: () =>
                                              _cancelBooking(booking),
                                          child: const Text('Huy'),
                                        ),
                                      ],
                                    ),
                                ],
                              ),
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

