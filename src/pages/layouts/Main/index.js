import React, { useEffect, useMemo, useState } from "react";
import {
  DashboardOutlined,
  EnvironmentOutlined,
  LogoutOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Layout } from "antd";
import NavBar from "../../components/NavBar/NavBar";
import SideBar from "../../components/SideBar/SideBar";
import TopicMenu from "../../components/TopicMenu";
import Footer from "../../components/Footer";
import { filterMenuByAccess, getRoleLabel, getUserRole, USER_ROLES } from "../../../utils/access";

const baseMenu = [
  {
    label: "Administrator Dashboard",
    key: "/dashboard",
    icon: <DashboardOutlined />,
    allowedRoles: [USER_ROLES.ADMIN],
  },
  {
    label: "Staff Dashboard",
    key: "/staff/dashboard",
    icon: <DashboardOutlined />,
    allowedRoles: [USER_ROLES.STAFF],
  },
  {
    label: "Municipal Staff Dashboard",
    key: "/municipal/dashboard",
    icon: <DashboardOutlined />,
    allowedRoles: [USER_ROLES.MUNICIPAL_STAFF],
  },
  {
    label: "Viewer Dashboard",
    key: "/viewer/dashboard",
    icon: <DashboardOutlined />,
    allowedRoles: [USER_ROLES.VIEWER],
  },
  {
    label: "Barangay / Purok / Precinct",
    key: "/barangays",
    icon: <EnvironmentOutlined />,
    allowedRoles: [USER_ROLES.ADMIN, USER_ROLES.STAFF, USER_ROLES.MUNICIPAL_STAFF, USER_ROLES.VIEWER],
  },
  {
    label: "Voters",
    key: "/voters",
    icon: <TeamOutlined />,
    allowedRoles: [USER_ROLES.ADMIN, USER_ROLES.STAFF, USER_ROLES.MUNICIPAL_STAFF, USER_ROLES.VIEWER],
  },
  {
    label: "Accounts",
    key: "/account",
    icon: <UserOutlined />,
    allowedRoles: [USER_ROLES.ADMIN],
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

  const navTitle = hydrated ? getRoleLabel(getUserRole()) : "User";
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
