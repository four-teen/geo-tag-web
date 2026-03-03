import React, { useEffect, useMemo, useState } from "react";
import { DashboardOutlined, EnvironmentOutlined, LogoutOutlined, UserOutlined } from "@ant-design/icons";
import { Layout } from "antd";
import NavBar from "../../components/NavBar/NavBar";
import SideBar from "../../components/SideBar/SideBar";
import TopicMenu from "../../components/TopicMenu";
import Footer from "../../components/Footer";
import { filterMenuByAccess, GEO_PERMISSIONS, isAdministrator } from "../../../utils/access";

const baseMenu = [
  {
    label: "Administrator Dashboard",
    key: "/dashboard",
    icon: <DashboardOutlined />,
    adminOnly: true,
    requiredPermissions: [GEO_PERMISSIONS.MANAGE_GEO, GEO_PERMISSIONS.VIEW_GEO],
  },
  {
    label: "Staff Dashboard",
    key: "/staff/dashboard",
    icon: <DashboardOutlined />,
    staffOnly: true,
    requiredPermissions: [GEO_PERMISSIONS.VIEW_GEO, GEO_PERMISSIONS.MANAGE_GEO],
  },
  {
    label: "Barangay / Purok / Precinct",
    key: "/barangays",
    icon: <EnvironmentOutlined />,
    adminOnly: true,
    requiredPermissions: [GEO_PERMISSIONS.MANAGE_GEO],
  },
  {
    label: "Account",
    key: "/account",
    icon: <UserOutlined />,
  },
  {
    label: "Logout",
    key: "/logout",
    icon: <LogoutOutlined />,
  },
];

const Main = ({ children }) => {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const menuItems = useMemo(() => {
    if (!hydrated) return [];
    return filterMenuByAccess(baseMenu);
  }, [hydrated]);

  const navTitle = hydrated && isAdministrator() ? "Administrator" : "Staff";
  const menu = <TopicMenu menu={menuItems} />;

  return (
    <div className="App">
      <NavBar menu={menu} title={navTitle} />
      <Layout>
        <SideBar menu={menu} />
        <Layout.Content className="content p-2">{children}</Layout.Content>
      </Layout>
      <Footer />
    </div>
  );
};

export default Main;
