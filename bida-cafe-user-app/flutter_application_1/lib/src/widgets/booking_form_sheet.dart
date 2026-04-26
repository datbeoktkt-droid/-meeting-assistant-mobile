part of '../app.dart';

class _BookingFormSheet extends StatefulWidget {
  const _BookingFormSheet({
    required this.api,
    required this.token,
    required this.tables,
  });

  final ApiClient api;
  final String token;
  final List<TableInfo> tables;

  @override
  State<_BookingFormSheet> createState() => _BookingFormSheetState();
}

class _BookingFormSheetState extends State<_BookingFormSheet> {
  final TextEditingController _notesController = TextEditingController();
  int? _selectedTableId;
  int _durationMinutes = 60;
  bool _submitting = false;
  DateTime _bookingStart = DateTime.now().add(const Duration(minutes: 30));

  @override
  void initState() {
    super.initState();
    if (widget.tables.isNotEmpty) {
      _selectedTableId = widget.tables.first.tableId;
    }
  }

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _pickDateTime() async {
    final now = DateTime.now();
    final date = await showDatePicker(
      context: context,
      initialDate: _bookingStart,
      firstDate: now,
      lastDate: now.add(const Duration(days: 30)),
    );
    if (date == null || !mounted) {
      return;
    }
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(_bookingStart),
    );
    if (time == null) {
      return;
    }
    setState(() {
      _bookingStart = DateTime(
        date.year,
        date.month,
        date.day,
        time.hour,
        time.minute,
      );
    });
  }

  Future<void> _submit() async {
    if (_selectedTableId == null) {
      return;
    }

    setState(() {
      _submitting = true;
    });

    try {
      await widget.api.createBooking(
        token: widget.token,
        tableId: _selectedTableId!,
        bookingStart: _bookingStart,
        durationMinutes: _durationMinutes,
        notes: _notesController.text.trim().isEmpty
            ? null
            : _notesController.text.trim(),
      );
      if (!mounted) {
        return;
      }
      Navigator.of(context).pop(true);
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
          _submitting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 20, 20, bottomInset + 20),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const Expanded(
                  child: Text(
                    'Dat ban',
                    style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<int>(
              value: _selectedTableId,
              decoration: const InputDecoration(
                labelText: 'Chon ban',
                border: OutlineInputBorder(),
              ),
              items: widget.tables.map((table) {
                return DropdownMenuItem<int>(
                  value: table.tableId,
                  child: Text(
                    'Ban ${table.tableNumber}${table.isVip ? ' | VIP' : ''}',
                  ),
                );
              }).toList(),
              onChanged: (value) {
                setState(() {
                  _selectedTableId = value;
                });
              },
            ),
            const SizedBox(height: 14),
            OutlinedButton.icon(
              onPressed: _pickDateTime,
              icon: const Icon(Icons.schedule_outlined),
              label: Text('Gio den: ${formatDate(_bookingStart)}'),
            ),
            const SizedBox(height: 14),
            DropdownButtonFormField<int>(
              value: _durationMinutes,
              decoration: const InputDecoration(
                labelText: 'Thoi luong',
                border: OutlineInputBorder(),
              ),
              items: const [
                DropdownMenuItem(value: 60, child: Text('60 phut')),
                DropdownMenuItem(value: 90, child: Text('90 phut')),
                DropdownMenuItem(value: 120, child: Text('120 phut')),
              ],
              onChanged: (value) {
                if (value == null) {
                  return;
                }
                setState(() {
                  _durationMinutes = value;
                });
              },
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _notesController,
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: 'Ghi chu',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 18),
            FilledButton(
              onPressed: _submitting ? null : _submit,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF0CC38C),
                minimumSize: const Size.fromHeight(50),
              ),
              child: Text(_submitting ? 'Dang dat...' : 'Xac nhan dat ban'),
            ),
          ],
        ),
      ),
    );
  }
}
