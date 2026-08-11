// Unit tests run with zero secrets (CI parity), but the harness reads its
// Trigger environment from the key that real processes always hold. Seed a
// representative dev key so suites exercise the dev path by default;
// environment-behavior tests override and restore their own.
if (!process.env.TRIGGER_SECRET_KEY) {
	process.env.TRIGGER_SECRET_KEY = "tr_dev_test";
}
