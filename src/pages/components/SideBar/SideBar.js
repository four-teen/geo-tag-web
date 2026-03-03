import React, { useEffect, useMemo, useState } from "react";
import { Layout } from "antd";
import { UserOutlined } from "@ant-design/icons";
import Cookies from "js-cookie";
import Image from "next/image";

const AVATAR_UPDATED_EVENT = "geo-avatar-updated";

function getAvatarStorageKey(userId) {
  return `geoAvatar:${userId || "guest"}`;
}

const SideBar = ({ menu }) => {
  const [username, setUsername] = useState("User");
  const [designation, setDesignation] = useState("User");
  const [userId, setUserId] = useState("guest");
  const [avatarSrc, setAvatarSrc] = useState("");
  const userInitial = useMemo(() => username.charAt(0).toUpperCase(), [username]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setUsername(Cookies.get("username") || "User");
    setDesignation(Cookies.get("designation") || "User");
    setUserId(Cookies.get("id") || "guest");
  }, []);

  useEffect(() => {
    const syncAvatar = () => {
      if (typeof window === "undefined") return;

      const saved = window.localStorage.getItem(getAvatarStorageKey(userId));
      setAvatarSrc(saved || Cookies.get("avatar_url") || "");
    };

    syncAvatar();
    window.addEventListener("storage", syncAvatar);
    window.addEventListener(AVATAR_UPDATED_EVENT, syncAvatar);

    return () => {
      window.removeEventListener("storage", syncAvatar);
      window.removeEventListener(AVATAR_UPDATED_EVENT, syncAvatar);
    };
  }, [userId]);

  return (
    <Layout.Sider
      className="sidebar"
      breakpoint="lg"
      theme="light"
      collapsedWidth={0}
      trigger={null}
      width={280}
    >
      <div className="sidebar-inner">
        <div className="sidebar-menu">{menu}</div>

        <div className="sidebar-profile">
          {avatarSrc ? (
            <Image
              src={avatarSrc}
              alt={`${username} avatar`}
              width={46}
              height={46}
              className="sidebar-profile-avatar"
              unoptimized
            />
          ) : (
            <div className="sidebar-profile-avatar sidebar-profile-avatar-fallback">
              {userInitial || <UserOutlined />}
            </div>
          )}

          <div className="sidebar-profile-text">
            <p className="sidebar-profile-name">{username}</p>
            <p className="sidebar-profile-role">{designation}</p>
          </div>
        </div>
      </div>
    </Layout.Sider>
  );
};

export default SideBar;
