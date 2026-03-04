import Head from "next/head";
import Image from "next/image";
import { Button, Form, Input } from "antd";
import { useRouter } from "next/router";
import { ToastContainer, toast } from "react-toastify";
import Cookies from "js-cookie";
import { login } from "./api/login";
import { getDefaultLandingPath } from "../utils/access";

export default function Home() {
  const router = useRouter();

  const onFinish = async (values) => {
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
      Cookies.set("must_change_password", "0");
      Cookies.set("barangay_scope", res.data?.data?.barangay_scope || "ALL");
      Cookies.set("barangay_ids", JSON.stringify(res.data?.data?.barangay_ids || []));
      Cookies.set("tokenApiUrl", process.env.NEXT_PUBLIC_API_URL || "");

      toast.success("Login success");

      setTimeout(() => {
        router.push({ pathname: getDefaultLandingPath() });
      }, 800);
    } catch (error) {
      toast.error("Login failed");
    }
  };

  return (
    <>
      <Head>
        <title>Geo Tagging | Login</title>
      </Head>

      <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-slate-100">
        <div className="flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-white rounded-lg shadow p-6">
            <div className="flex justify-center mb-4">
              <Image src="/logo.jpg" width={110} height={110} className="rounded-full" alt="logo" />
            </div>

            <h1 className="text-center text-xl font-semibold text-slate-800">Geo Tagging Login</h1>
            <p className="text-center text-sm text-slate-500 mb-5">Administrator, staff, municipal staff, and viewer access</p>

            <Form layout="vertical" onFinish={onFinish} autoComplete="off">
              <Form.Item
                label="Username"
                name="username"
                rules={[{ required: true, message: "Please input your username." }]}
              >
                <Input size="large" />
              </Form.Item>

              <Form.Item
                label="Password"
                name="password"
                rules={[{ required: true, message: "Please input your password." }]}
              >
                <Input.Password size="large" />
              </Form.Item>

              <Button size="large" className="w-full bg-blue-700 text-white" htmlType="submit">
                Login
              </Button>
            </Form>
          </div>
        </div>

        <div
          className="hidden lg:block"
          style={{
            backgroundImage: "url('/bg_1.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      </div>

      <ToastContainer />
    </>
  );
}
