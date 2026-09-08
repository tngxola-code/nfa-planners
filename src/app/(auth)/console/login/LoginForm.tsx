"use client";

import { FormEvent, useState } from "react";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";

type FieldErrors = {
  email?: string;
  password?: string;
};

type LoginResponse = {
  ok?: boolean;
  returnTo?: string;
  error?: string;
};

const DEFAULT_RETURN_TO =
    "/console/dashboard";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] =
      useState("");

  const [password, setPassword] =
      useState("");

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [remember, setRemember] =
      useState(false);

  const [
    fieldErrors,
    setFieldErrors,
  ] = useState<FieldErrors>({});

  const [error, setError] =
      useState<string | null>(null);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  function validateForm(): boolean {
    const errors: FieldErrors = {};

    const trimmedEmail =
        email.trim();

    if (!trimmedEmail) {
      errors.email =
          "Email address is required.";
    } else if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
            trimmedEmail,
        )
    ) {
      errors.email =
          "Enter a valid email address.";
    }

    if (!password) {
      errors.password =
          "Password is required.";
    }

    setFieldErrors(errors);

    return (
        Object.keys(errors).length === 0
    );
  }

  async function onSubmit(
      event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError(null);

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(
          "/api/auth/login",
          {
            method: "POST",

            headers: {
              "Content-Type":
                  "application/json",

              Accept:
                  "application/json",
            },

            credentials:
                "same-origin",

            cache: "no-store",

            body: JSON.stringify({
              email: email.trim(),
              password,
              remember,

              returnTo:
                  searchParams.get(
                      "returnTo",
                  ),
            }),
          },
      );

      let data: LoginResponse;

      try {
        data =
            (await response.json()) as LoginResponse;
      } catch {
        setError(
            "Unable to process the authentication response. Please try again.",
        );

        return;
      }

      if (
          !response.ok ||
          !data.ok
      ) {
        setError(
            data.error ??
            "Invalid email or password.",
        );

        return;
      }

      const destination =
          data.returnTo &&
          data.returnTo.startsWith(
              "/console/",
          )
              ? data.returnTo
              : DEFAULT_RETURN_TO;

      router.replace(destination);
      router.refresh();
    } catch {
      setError(
          "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
      <form
          className="nfa-login-form"
          onSubmit={onSubmit}
          noValidate
      >
        {error && (
            <div
                className="nfa-error"
                role="alert"
                aria-live="polite"
            >
              {error}
            </div>
        )}

        <label
            className="nfa-field"
            htmlFor="email"
        >
          <span>Email</span>

          <div
              className={`nfa-input-wrap ${
                  fieldErrors.email
                      ? "nfa-input-error"
                      : ""
              }`}
          >
            <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
            >
              <rect
                  x="3.5"
                  y="5.5"
                  width="17"
                  height="13"
                  rx="1.5"
              />

              <path d="m4.5 7 7.5 5.6L19.5 7" />
            </svg>

            <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
                required
                value={email}
                aria-invalid={Boolean(
                    fieldErrors.email,
                )}
                aria-describedby={
                  fieldErrors.email
                      ? "email-error"
                      : undefined
                }
                onChange={(event) => {
                  setEmail(
                      event.target.value,
                  );

                  if (
                      fieldErrors.email
                  ) {
                    setFieldErrors(
                        (current) => ({
                          ...current,
                          email: undefined,
                        }),
                    );
                  }

                  if (error) {
                    setError(null);
                  }
                }}
            />
          </div>

          {fieldErrors.email && (
              <span
                  id="email-error"
                  className="nfa-field-error"
                  role="alert"
              >
            {fieldErrors.email}
          </span>
          )}
        </label>

        <label
            className="nfa-field"
            htmlFor="password"
        >
          <span>Password</span>

          <div
              className={`nfa-input-wrap ${
                  fieldErrors.password
                      ? "nfa-input-error"
                      : ""
              }`}
          >
            <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
            >
              <rect
                  x="5.5"
                  y="10"
                  width="13"
                  height="10"
                  rx="1.5"
              />

              <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" />
            </svg>

            <input
                id="password"
                name="password"
                type={
                  showPassword
                      ? "text"
                      : "password"
                }
                autoComplete="current-password"
                placeholder="Enter your password"
                required
                value={password}
                aria-invalid={Boolean(
                    fieldErrors.password,
                )}
                aria-describedby={
                  fieldErrors.password
                      ? "password-error"
                      : undefined
                }
                onChange={(event) => {
                  setPassword(
                      event.target.value,
                  );

                  if (
                      fieldErrors.password
                  ) {
                    setFieldErrors(
                        (current) => ({
                          ...current,
                          password:
                          undefined,
                        }),
                    );
                  }

                  if (error) {
                    setError(null);
                  }
                }}
            />

            <button
                className="nfa-password-toggle"
                type="button"
                aria-label={
                  showPassword
                      ? "Hide password"
                      : "Show password"
                }
                aria-pressed={
                  showPassword
                }
                onClick={() =>
                    setShowPassword(
                        (value) => !value,
                    )
                }
            >
              <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
              >
                <path d="M2.5 12s3.5-5 9.5-5 9.5 5 9.5 5-3.5 5-9.5 5-9.5-5-9.5-5Z" />
                <circle
                    cx="12"
                    cy="12"
                    r="2.5"
                />
              </svg>
            </button>
          </div>

          {fieldErrors.password && (
              <span
                  id="password-error"
                  className="nfa-field-error"
                  role="alert"
              >
            {
              fieldErrors.password
            }
          </span>
          )}
        </label>

        <div className="nfa-form-options">
          <label className="nfa-remember">
            <input
                type="checkbox"
                checked={remember}
                onChange={(event) =>
                    setRemember(
                        event.target.checked,
                    )
                }
            />

            <span>
            Remember me
          </span>
          </label>

          <a href="/forgot-password">
            Forgot your password?
          </a>
        </div>

        <button
            className="nfa-submit"
            type="submit"
            disabled={submitting}
        >
          {submitting
              ? "Signing in…"
              : "Sign in"}
        </button>
      </form>
  );
}