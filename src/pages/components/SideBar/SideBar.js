import React from "react";
import { Layout } from "antd";

const SideBar = ({ menu }) => {
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
        <div className="sidebar-fade" />
      </div>
    </Layout.Sider>
  );
};

export default SideBar;
