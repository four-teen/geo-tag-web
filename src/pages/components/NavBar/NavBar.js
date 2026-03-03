import React, { useState } from "react";
import { Drawer, Button } from "antd";
import { MenuOutlined, UserOutlined } from "@ant-design/icons";
import Link from "next/link";
import Image from "next/image";
import Cookies from "js-cookie";

const AVATAR_UPDATED_EVENT = "geo-avatar-updated";

function getAvatarStorageKey(userId) {
  return `geoAvatar:${userId || "guest"}`;
}

const NavBar = ({ menu, title = "Geo Tagging" }) => {
  const [visible, setVisible] = useState(false);
  const [username, setUsername] = useState("User");
  const [designation, setDesignation] = useState("User");
  const [userId, setUserId] = useState("guest");
  const [avatarSrc, setAvatarSrc] = useState("");

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    setUsername(Cookies.get("username") || "User");
    setDesignation(Cookies.get("designation") || "User");
    setUserId(Cookies.get("id") || "guest");
  }, []);

  React.useEffect(() => {
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
    <nav className="navbar flex">
      <Button
        className="menu"
        type=""
        icon={<MenuOutlined />}
        onClick={() => setVisible(true)}
      />
      <Drawer
        title="Topics"
        placement="left"
        onClick={() => setVisible(false)}
        onClose={() => setVisible(false)}
        visible={visible}
        width={280}
        bodyStyle={{ padding: 0 }}
      >
        <div className="mobile-drawer-content">
          <div className="mobile-drawer-menu">{menu}</div>

          <div className="mobile-drawer-profile">
            {avatarSrc ? (
              <Image
                src={avatarSrc}
                alt={`${username} avatar`}
                width={44}
                height={44}
                className="sidebar-profile-avatar"
                unoptimized
              />
            ) : (
              <div className="sidebar-profile-avatar sidebar-profile-avatar-fallback">
                {username.charAt(0).toUpperCase() || <UserOutlined />}
              </div>
            )}

            <div className="sidebar-profile-text">
              <p className="sidebar-profile-name">{username}</p>
              <p className="sidebar-profile-role">{designation}</p>
            </div>
          </div>
        </div>
      </Drawer>
      <Link href={{ pathname: '/' }}>
        <Image src={'/logo.jpg'} width={80}
          height={80} className="logo rounded-full" alt="logo" />

      </Link>

      <h1 className="text-center ml-4 mt-2 text-lg text-blue-700 hidden lg:block">{title}</h1>
    </nav>
  );
};

export default NavBar;
