part of '../app.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, required this.onLogin});

  final ValueChanged<UserSession> onLogin;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final ApiClient _api = const ApiClient();
  final _phoneController = TextEditingController();
  final _pinController = TextEditingController();
  final _nameController = TextEditingController();
  bool _registerMode = false;
  bool _loading = false;
  String? _error;

  Future<void> _submit() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      if (_registerMode) {
        await _api.register(
          fullName: _nameController.text.trim(),
          phone: _phoneController.text.trim(),
          pin: _pinController.text.trim(),
        );
      }
      final loginResult = await _api.login(
        phone: _phoneController.text.trim(),
        pin: _pinController.text.trim(),
      );
      widget.onLogin(
        UserSession(
          token: loginResult['access_token'].toString(),
          refreshToken: loginResult['refresh_token'].toString(),
          user: AppUser.fromJson(loginResult['user'] as Map<String, dynamic>),
        ),
      );
    } on ApiException catch (error) {
      setState(() {
        _error = error.message;
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFFEAF8F3), Color(0xFFF8FBFA)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Card(
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(28),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Container(
                          height: 68,
                          width: 68,
                          decoration: BoxDecoration(
                            color: const Color(0xFF0B7D69),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: const Icon(
                            Icons.sports_bar_rounded,
                            color: Colors.white,
                            size: 30,
                          ),
                        ),
                        const SizedBox(height: 18),
                        Text(
                          'Bida & Coffee 82',
                          style: Theme.of(context).textTheme.headlineSmall
                              ?.copyWith(
                                fontWeight: FontWeight.w800,
                                color: const Color(0xFF17332D),
                              ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          _registerMode
                              ? 'Tao tai khoan de dung app.'
                              : 'Dang nhap bang so dien thoai va PIN.',
                          style: const TextStyle(color: Color(0xFF59746E)),
                        ),
                        const SizedBox(height: 22),
                        SegmentedButton<bool>(
                          showSelectedIcon: false,
                          segments: const [
                            ButtonSegment<bool>(
                              value: false,
                              label: Text('Dang nhap'),
                            ),
                            ButtonSegment<bool>(
                              value: true,
                              label: Text('Dang ky'),
                            ),
                          ],
                          selected: {_registerMode},
                          onSelectionChanged: (value) {
                            setState(() {
                              _registerMode = value.first;
                              _error = null;
                            });
                          },
                        ),
                        const SizedBox(height: 18),
                        if (_registerMode) ...[
                          _AppField(
                            controller: _nameController,
                            label: 'Ho va ten',
                            icon: Icons.person_outline,
                          ),
                          const SizedBox(height: 14),
                        ],
                        _AppField(
                          controller: _phoneController,
                          label: 'So dien thoai',
                          icon: Icons.phone_outlined,
                          keyboardType: TextInputType.phone,
                        ),
                        const SizedBox(height: 14),
                        _AppField(
                          controller: _pinController,
                          label: 'PIN',
                          icon: Icons.lock_outline,
                          keyboardType: TextInputType.number,
                          obscureText: true,
                        ),
                        if (_error != null) ...[
                          const SizedBox(height: 14),
                          Text(
                            _error!,
                            style: const TextStyle(color: Color(0xFFC04B40)),
                          ),
                        ],
                        const SizedBox(height: 18),
                        FilledButton(
                          onPressed: _loading ? null : _submit,
                          style: FilledButton.styleFrom(
                            minimumSize: const Size.fromHeight(54),
                            backgroundColor: const Color(0xFF0CC38C),
                          ),
                          child: Text(
                            _loading
                                ? 'Dang xu ly...'
                                : _registerMode
                                ? 'Tao tai khoan'
                                : 'Dang nhap',
                          ),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'May chu: ${ApiConfig.appBase}',
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.labelSmall,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
