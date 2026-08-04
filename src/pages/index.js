import Head from "next/head";
import Image from "next/image";
import { Button, Form, Input } from "antd";
import { useRouter } from "next/router";
import { useState } from "react";
import { toast } from "react-toastify";
import Cookies from "js-cookie";
import { login } from "./api/login";
import { getDefaultLandingPath } from "../utils/access";

export default function Home() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const onFinish = async (values) => {
    if (submitting) return;

    setSubmitting(true);

    try {
      const res = await login(values);

      const rawToken = res.data?.data?.token || "";
      const normalizedToken = rawToken.includes("|") ? rawToken.split("|")[1] : rawToken;

      Cookies.set("accessToken", normalizedToken);
      Cookies.set("id", res.data?.data?.id);
      Cookies.set("username", res.data?.data?.username || res.data?.data?.name);
      const avatarUrl =
        res.data?.data?.avatar_url ||
        res.data?.data?.profile_image ||
        res.data?.data?.profile_photo_url ||
        "";
      if (avatarUrl) {
        Cookies.set("avatar_url", avatarUrl);
      } else {
        Cookies.remove("avatar_url");
      }
      Cookies.set("designation", res.data?.data?.designation || "");
      Cookies.set("role", res.data?.data?.role || "staff");
      Cookies.set("is_active", String(res.data?.data?.is_active ? 1 : 0));
      Cookies.set("can_delete", String(res.data?.data?.can_delete ? 1 : 0));
      Cookies.set("must_change_password", "0");
      Cookies.set("barangay_scope", res.data?.data?.barangay_scope || "ALL");
      Cookies.set("barangay_ids", JSON.stringify(res.data?.data?.barangay_ids || []));
      Cookies.set("tokenApiUrl", process.env.NEXT_PUBLIC_API_URL || "");

      toast.success("Login successful", { position: "top-center" });
      await router.replace({ pathname: getDefaultLandingPath() });
    } catch (error) {
      toast.error("Login failed", { position: "top-center" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>Geo Tagging | Login</title>
      </Head>

      <div className="login-page">
        <main className="login-panel">
          <section className="login-card" aria-labelledby="login-heading">
            <div className="login-brand">
              <div className="login-logo">
                <Image
                  src="/logo.jpg"
                  width={110}
                  height={110}
                  priority
                  sizes="110px"
                  alt="Bagong Isulan logo"
                />
              </div>
            </div>

            <h1 id="login-heading" className="login-title">Geo Tagging Login</h1>
            <p className="login-subtitle">Administrator, staff, municipal staff, and viewer access</p>

            <Form className="login-form" layout="vertical" onFinish={onFinish} autoComplete="on">
              <Form.Item
                label="Username"
                name="username"
                rules={[{ required: true, message: "Please input your username." }]}
              >
                <Input
                  size="large"
                  autoComplete="username"
                  disabled={submitting}
                  spellCheck={false}
                />
              </Form.Item>

              <Form.Item
                label="Password"
                name="password"
                rules={[{ required: true, message: "Please input your password." }]}
              >
                <Input.Password
                  size="large"
                  autoComplete="current-password"
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
              >
                Login
              </Button>
            </Form>

            <p className="login-version">Version 0.8</p>
          </section>
        </main>

        <aside className="login-visual" aria-hidden="true">
          <Image
            src="/bg_1.jpg"
            alt=""
            fill
            priority
            quality={78}
            sizes="(min-width: 1024px) 52vw, 0px"
            className="login-visual-image"
          />
          <div className="login-visual-overlay" />
        </aside>
      </div>

    </>
  );
}
