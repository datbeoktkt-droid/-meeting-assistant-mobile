part of '../app.dart';

class _ProfilePage extends StatefulWidget {
  const _ProfilePage({
    required this.api,
    required this.token,
    required this.user,
  });

  final ApiClient api;
  final String token;
  final AppUser user;

  @override
  State<_ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<_ProfilePage> {
  late final TextEditingController _fullNameController;
  final TextEditingController _currentPinController = TextEditingController();
  final TextEditingController _newPinController = TextEditingController();
  bool _savingProfile = false;
  bool _savingPin = false;
  bool _loadingProfile = false;
  late AppUser _user;

  @override
  void initState() {
    super.initState();
    _user = widget.user;
    _fullNameController = TextEditingController(text: widget.user.fullName);
  }

  @override
  void dispose() {
    _fullNameController.dispose();
    _currentPinController.dispose();
    _newPinController.dispose();
    super.dispose();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
  }

  Future<void> _refreshProfile() async {
    if (_loadingProfile) {
      return;
    }
    _loadingProfile = true;
    try {
      final freshUser = await widget.api.fetchProfile(widget.token);
      if (!mounted) {
        return;
      }
      setState(() {
        _user = freshUser;
        _fullNameController.text = freshUser.fullName;
      });
    } catch (_) {
    } finally {
      _loadingProfile = false;
    }
  }

  Future<void> _saveProfile() async {
    final fullName = _fullNameController.text.trim();
    if (fullName.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Ho va ten khong duoc de trong.')),
      );
      return;
    }
    setState(() => _savingProfile = true);
    try {
      final updated = await widget.api.updateProfile(
        token: widget.token,
        fullName: fullName,
      );
      if (!mounted) return;
      setState(() => _user = updated);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Da cap nhat profile.')),
      );
      Navigator.of(context).pop(updated);
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message)),
      );
    } finally {
      if (mounted) {
        setState(() => _savingProfile = false);
      }
    }
  }

  Future<void> _changePin() async {
    if (_currentPinController.text.trim().isEmpty ||
        _newPinController.text.trim().length < 4) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('PIN moi phai co it nhat 4 ky tu.')),
      );
      return;
    }
    setState(() => _savingPin = true);
    try {
      await widget.api.changePin(
        token: widget.token,
        currentPin: _currentPinController.text.trim(),
        newPin: _newPinController.text.trim(),
      );
      if (!mounted) return;
      _currentPinController.clear();
      _newPinController.clear();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Da doi PIN thanh cong.')),
      );
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message)),
      );
    } finally {
      if (mounted) {
        setState(() => _savingPin = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _refreshProfile,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
        children: [
          _HeroCard(
            eyebrow: 'Ho so',
            title: _user.fullName,
            subtitle: '${_user.phone} | ${formatCurrency(_user.walletBalance)}',
          ),
          const SizedBox(height: 14),
          _SectionCard(
            title: 'Tai khoan',
            child: Row(
              children: [
                CircleAvatar(
                  radius: 30,
                  backgroundColor: const Color(0xFFE5FBF3),
                  backgroundImage: NetworkImage(
                    buildAvatarUrl(userId: _user.userId, phone: _user.phone),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _user.fullName,
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 18,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(_user.phone),
                      const SizedBox(height: 4),
                      Text(
                        'Tong nap: ${formatCurrency(_user.totalDeposited)}',
                        style: const TextStyle(color: Color(0xFF68817B)),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          _SectionCard(
            title: 'Thong tin ca nhan',
            child: Column(
              children: [
                _AppField(
                  controller: _fullNameController,
                  label: 'Ho va ten',
                  icon: Icons.person_outline,
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: _savingProfile ? null : _saveProfile,
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF0CC38C),
                    ),
                    child: Text(_savingProfile ? 'Dang luu...' : 'Luu thong tin'),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          _SectionCard(
            title: 'Doi PIN',
            child: Column(
              children: [
                _AppField(
                  controller: _currentPinController,
                  label: 'PIN hien tai',
                  icon: Icons.lock_outline,
                  keyboardType: TextInputType.number,
                  obscureText: true,
                ),
                const SizedBox(height: 12),
                _AppField(
                  controller: _newPinController,
                  label: 'PIN moi',
                  icon: Icons.lock_reset_outlined,
                  keyboardType: TextInputType.number,
                  obscureText: true,
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    onPressed: _savingPin ? null : _changePin,
                    child: Text(_savingPin ? 'Dang doi...' : 'Doi PIN'),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
