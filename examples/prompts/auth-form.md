# Example Prompt — Auth Form (Login / Sign-up)

**Intent:** generate

**Prompt:**

```
Build a complete authentication flow in React + TypeScript with:
- Two views: Login and Sign-up, toggled by a link at the bottom of the form
- Login form fields: Email, Password
- Sign-up form fields: Full name, Email, Password, Confirm password
- Client-side validation:
    - Email must be a valid format
    - Password minimum 8 characters, at least one uppercase letter and one digit
    - Confirm password must match password
    - Show inline error messages below each field on blur
- Password visibility toggle (eye icon)
- Show/hide password strength meter on the sign-up form
  (Weak / Fair / Strong based on length + character variety)
- A loading spinner on the submit button while "submitting" (simulate 1.5 s delay)
- After successful login/sign-up show a simple "Welcome, <name>!" dashboard
  card with a Sign-out link that returns to the login view
- Accessible: all inputs have associated <label>, error messages linked via
  aria-describedby, focus ring visible, role="alert" on error summary
- Dark mode (Tailwind, class-based)
- A clean card layout centred on the page with a subtle background pattern

Simulate auth in memory — no real backend.
All logic in App.tsx; sub-components: AuthCard, LoginForm, SignupForm,
InputField, PasswordStrengthMeter, SubmitButton, WelcomeDashboard.
```

**Expected output:**
A pixel-polished auth card that switches between Login and Sign-up views.
Validation runs on blur and on submit. The password strength meter updates
in real-time. Successful login shows a welcome screen. Fully accessible.

**Tips:**
- To hook this to a real backend, follow up with: *"Replace the simulated
  login with a fetch() call to POST /api/auth/login and handle 401 errors."*
- To add social login buttons: *"Add 'Continue with Google' and 'Continue
  with GitHub' OAuth buttons above the form divider."*
- To persist session: *"Store the logged-in user in localStorage so the
  Welcome screen is shown immediately on page reload."*
