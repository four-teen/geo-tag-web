import React, { useState } from "react";
import { Drawer, Button } from "antd";
import { MenuOutlined, UserOutlined } from "@ant-design/icons";
import Link from "next/link";
import Cookies from "js-cookie";
import Image from "next/image";

const NavBar = ({ menu, title = "Geo Tagging" }) => {
  const [visible, setVisible] = useState(false);
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
      >
        {menu}
      </Drawer>
      <Link href={{ pathname: '/' }}>
        <Image src={'/logo.jpg'} width={80}
          height={80} className="logo rounded-full" alt="logo" />

      </Link>

      <h1 className="text-center ml-4 mt-2 text-lg text-blue-700 hidden lg:block">{title}</h1>
      <Button className=" text-right absolute   right-12 ">
        <UserOutlined /><span className="text-blue-500 font-bold capitalize">{Cookies.get('username')}</span>
      </Button>


    </nav>
  );
};

export default NavBar;
