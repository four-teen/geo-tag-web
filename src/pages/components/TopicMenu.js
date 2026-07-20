import React, { useEffect, useState } from "react";
import { Menu } from "antd";
import { useRouter } from "next/router";
import { clearSessionCookies } from "../../utils/access";

const TopicMenu = ({ menu }) => {
  const router = useRouter();
  const [current, setCurrent] = useState("/dashboard");

  const onClick = ({ key }) => {
    if (key === "/logout") {
      clearSessionCookies();
      router.push({ pathname: "/" });
      return;
    }

    router.push({ pathname: key });
    setCurrent(key);
  };

  useEffect(() => {
    setCurrent(router?.pathname);
  }, [router?.pathname]);

  return (
    <Menu
      className="sidebar-navigation"
      mode="inline"
      onClick={onClick}
      selectedKeys={[current]}
      items={menu}
    />
  );
};

export default TopicMenu;
