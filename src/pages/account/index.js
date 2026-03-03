import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { Button, Card, message } from "antd";
import { DeleteOutlined, UploadOutlined } from "@ant-design/icons";
import Cookies from "js-cookie";
import Image from "next/image";
import Layout from "../layouts";
import { Auth } from "../api/auth";

const AVATAR_UPDATED_EVENT = "geo-avatar-updated";
const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024;

function getAvatarStorageKey(userId) {
  return `geoAvatar:${userId || "guest"}`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AccountPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("guest");
  const [username, setUsername] = useState("User");
  const [designation, setDesignation] = useState("User");
  const [avatarSrc, setAvatarSrc] = useState("");
  const [saving, setSaving] = useState(false);

  const avatarStorageKey = useMemo(() => getAvatarStorageKey(userId), [userId]);

  useEffect(() => {
    const guard = async () => {
      const auth = await Auth(router?.pathname);
      if (auth !== router?.pathname) {
        router.push({ pathname: auth });
      }
    };

    guard();
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setUserId(Cookies.get("id") || "guest");
    setUsername(Cookies.get("username") || "User");
    setDesignation(Cookies.get("designation") || "User");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const stored = window.localStorage.getItem(avatarStorageKey);
    setAvatarSrc(stored || Cookies.get("avatar_url") || "");
  }, [avatarStorageKey]);

  const onUploadAvatar = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;
    if (!file.type.startsWith("image/")) {
      message.error("Please select an image file.");
      return;
    }
    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      message.error("Image is too large. Maximum size is 2MB.");
      return;
    }

    try {
      setSaving(true);
      const dataUrl = await readFileAsDataUrl(file);
      setAvatarSrc(dataUrl);
      window.localStorage.setItem(avatarStorageKey, dataUrl);
      window.dispatchEvent(new Event(AVATAR_UPDATED_EVENT));
      message.success("Profile image updated.");
    } catch (error) {
      message.error("Unable to read image file.");
    } finally {
      setSaving(false);
    }
  };

  const onRemoveAvatar = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(avatarStorageKey);
      window.dispatchEvent(new Event(AVATAR_UPDATED_EVENT));
    }
    Cookies.remove("avatar_url");
    setAvatarSrc("");
    message.success("Profile image removed.");
  };

  return (
    <Layout>
      <Head>
        <title>Account</title>
      </Head>

      <main className="p-6">
        <h1 className="text-2xl font-semibold text-slate-800">Account</h1>
        <p className="text-slate-500 mt-1">Manage your display profile on the sidebar.</p>

        <Card className="mt-6 max-w-xl">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            {avatarSrc ? (
              <Image
                src={avatarSrc}
                alt={`${username} avatar`}
                width={96}
                height={96}
                className="account-avatar"
                unoptimized
              />
            ) : (
              <div className="account-avatar account-avatar-fallback">{username.charAt(0).toUpperCase()}</div>
            )}

            <div className="flex-1">
              <p className="text-lg font-semibold text-slate-800 capitalize">{username}</p>
              <p className="text-slate-500 capitalize">{designation}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                <label className="ant-btn ant-btn-default cursor-pointer">
                  <UploadOutlined /> Upload Photo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onUploadAvatar}
                    disabled={saving}
                  />
                </label>
                <Button icon={<DeleteOutlined />} onClick={onRemoveAvatar} disabled={saving || !avatarSrc}>
                  Remove
                </Button>
              </div>
              <p className="mt-3 text-xs text-slate-400">Allowed: image files only, max size 2MB.</p>
            </div>
          </div>
        </Card>
      </main>
    </Layout>
  );
}
