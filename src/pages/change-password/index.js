import Head from "next/head";
import { Button, Form, Input } from "antd";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import { toast } from "react-toastify";
import { Auth } from "../api/auth";
import { changePassword } from "../api/login";
import { clearSessionCookies, getDefaultLandingPath } from "../../utils/access";
import { extractApiErrorMessage } from "../../utils/api";

export default function ChangePassword() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!router.isReady) return;

    let active = true;
    Auth(router.pathname).then((destination) => {
      if (!active) return;

      if (destination !== router.pathname) {
        router.replace({ pathname: destination });
        return;
      }

      setCheckingSession(false);
    });

    return () => {
      active = false;
    };
  }, [router, router.isReady, router.pathname]);

  const onFinish = async (values) => {
    if (submitting) return;
    setSubmitting(true);

    try {
      await changePassword(values);
      Cookies.set("must_change_password", "0");
      toast.success("Password changed successfully", { position: "top-center" });
      await router.replace({ pathname: getDefaultLandingPath() });
    } catch (error) {
      toast.error(
        extractApiErrorMessage(error, "Unable to change password."),
        { position: "top-center" }
      );
    } finally {
      setSubmitting(false);
    }
  };

  const signOut = async () => {
    clearSessionCookies();
    await router.replace({ pathname: "/" });
  };

  if (checkingSession) return null;

  return (
    <>
      <Head>
        <title>Geo Tagging | Change Password</title>
      </Head>

      <div className="login-page">
        <main className="login-panel" style={{ gridColumn: "1 / -1" }}>
          <section className="login-card" aria-labelledby="change-password-heading">
            <h1 id="change-password-heading" className="login-title">
              Change Your Password
            </h1>
            <p className="login-subtitle">
              You must set a new password before continuing.
            </p>

            <Form className="login-form" layout="vertical" onFinish={onFinish}>
              <Form.Item
                label="Current Password"
                name="current_password"
                rules={[{ required: true, message: "Enter your current password." }]}
              >
                <Input.Password
                  size="large"
                  autoComplete="current-password"
                  disabled={submitting}
                />
              </Form.Item>

              <Form.Item
                label="New Password"
                name="password"
                dependencies={["current_password"]}
                rules={[
                  { required: true, message: "Enter your new password." },
                  { min: 6, message: "Password must be at least 6 characters." },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || value !== getFieldValue("current_password")) {
                        return Promise.resolve();
                      }
                      return Promise.reject(
                        new Error("New password must differ from the current password.")
                      );
                    },
                  }),
                ]}
              >
                <Input.Password
                  size="large"
                  autoComplete="new-password"
                  disabled={submitting}
                />
              </Form.Item>

              <Form.Item
                label="Confirm New Password"
                name="password_confirmation"
                dependencies={["password"]}
                rules={[
                  { required: true, message: "Confirm your new password." },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue("password") === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error("Passwords do not match."));
                    },
                  }),
                ]}
              >
                <Input.Password
                  size="large"
                  autoComplete="new-password"
                  disabled={submitting}
                />
              </Form.Item>

              <Button
                type="primary"
                size="large"
                className="login-submit"
                htmlType="submit"
                loading={submitting}
                disabled={submitting}
                block
              >
                Change Password
              </Button>

              <Button
                type="text"
                size="large"
                onClick={signOut}
                disabled={submitting}
                block
              >
                Sign Out
              </Button>
            </Form>
          </section>
        </main>
      </div>
    </>
  );
}
