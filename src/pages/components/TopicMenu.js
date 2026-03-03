import React, { useEffect, useState } from "react";
import {Menu} from "antd";
import { MenuOutlined } from "@ant-design/icons";
import { useRouter } from "next/router";
import { clearSessionCookies } from "../../utils/access";

const TopicMenu = ({ menu, selectedKey, changeSelectedKey }) => {
  const router = useRouter();
  const [current, setCurrent] = useState('/dashboard');
  const onClick = (e) => {

    if(e.key == '/logout'){
     clearSessionCookies();
     router.push({
      pathname: `/`,
  });
    }
    else{
      router.push({
        pathname: `${e.key}`,
    });
      setCurrent(e.key);
  

    }


   

  };

  useEffect(()=>{
    setCurrent(router?.pathname)
  },[router?.pathname])

  return (
    <Menu mode="inline" onClick={onClick} selectedKeys={[current]} items={menu}>
    
    </Menu>
  );
}
export default TopicMenu;
