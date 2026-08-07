import React, { useEffect, useMemo, useState } from "react";
import {
  DashboardOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  HistoryOutlined,
  LogoutOutlined,
  ReadOutlined,
  TagsOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Layout } from "antd";
import NavBar from "../../components/NavBar/NavBar";
import SideBar from "../../components/SideBar/SideBar";
import TopicMenu from "../../components/TopicMenu";
import Footer from "../../components/Footer";
import { filterMenuByAccess, getRoleLabel, getUserRole, USER_ROLES } from "../../../utils/access";

const sharedRoles = [
  USER_ROLES.ADMIN,
  USER_ROLES.STAFF,
  USER_ROLES.VOTER_EDITOR,
  USER_ROLES.MUNICIPAL_STAFF,
  USER_ROLES.VIEWER,
];

const baseMenu = [
  {
    type: "group",
    key: "overview-group",
    label: "Overview",
    children: [
      {
        label: "Dashboard",
        key: "/dashboard",
        icon: <DashboardOutlined />,
        allowedRoles: [USER_ROLES.ADMIN],
      },
      {
        label: "Dashboard",
        key: "/staff/dashboard",
        icon: <DashboardOutlined />,
        allowedRoles: [USER_ROLES.STAFF, USER_ROLES.VOTER_EDITOR],
      },
      {
        label: "Dashboard",
        key: "/municipal/dashboard",
        icon: <DashboardOutlined />,
        allowedRoles: [USER_ROLES.MUNICIPAL_STAFF],
      },
      {
        label: "Dashboard",
        key: "/viewer/dashboard",
        icon: <DashboardOutlined />,
        allowedRoles: [USER_ROLES.VIEWER],
      },
    ],
  },
  {
    type: "group",
    key: "operations-group",
    label: "Core operations",
    children: [
      {
        label: "Voter Masterlist",
        key: "/voters",
        icon: <TeamOutlined />,
        allowedRoles: sharedRoles,
      },
      {
        label: 'Reports',
        key: '/reports',
        icon: <FileTextOutlined />,
        allowedRoles: [USER_ROLES.ADMIN],
      },
      {
        label: "Voter Imports",
        key: "/voter-imports",
        allowedRoles: [USER_ROLES.ADMIN],
      },
      {
        label: "Locations & Precincts",
        key: "/barangays",
        icon: <EnvironmentOutlined />,
        allowedRoles: sharedRoles,
      },
    ],
  },
  {
    type: "group",
    key: "reference-group",
    label: "Reference data",
    children: [
      {
        label: "Tribes",
        key: "/tribes",
        icon: <TagsOutlined />,
        allowedRoles: sharedRoles,
      },
      {
        label: "Religions",
        key: "/religions",
        icon: <ReadOutlined />,
        allowedRoles: sharedRoles,
      },
    ],
  },
  {
    type: "group",
    key: "administration-group",
    label: "Administration",
    children: [
      {
        label: "User Accounts",
        key: "/account",
        icon: <UserOutlined />,
        allowedRoles: [USER_ROLES.ADMIN],
      },
      {
        label: "Staff Activity Log",
        key: "/activity-logs",
        icon: <HistoryOutlined />,
        allowedRoles: [USER_ROLES.ADMIN],
      },
    ],
  },
  {
    type: "group",
    key: "session-group",
    label: "Session",
    children: [
      {
        label: "Sign Out",
        key: "/logout",
        icon: <LogoutOutlined />,
        danger: true,
      },
    ],
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
