import { DashboardState, bitable, dashboard } from "@lark-base-open/js-sdk";
import React from "react";
import { useLayoutEffect, useState } from "react";

function updateTheme(theme: string) {
  document.body.setAttribute('theme-mode', theme);
}

/** 跟随主题色变化 */
export function useTheme() {
  const [bgColor, setBgColor] = useState('#ffffff');
  useLayoutEffect(() => {
    dashboard.getTheme().then((res) => {
      setBgColor(res.chartBgColor);
      updateTheme(res.theme.toLocaleLowerCase());
    }).catch(e => console.error("getTheme error", e));

    dashboard.onThemeChange((res) => {
      setBgColor(res.data.chartBgColor);
      updateTheme(res.data.theme.toLocaleLowerCase());
    })
  }, [])
  return {
    bgColor,
  }
}

/** 初始化、更新config */
export function useConfig(updateConfig: (data: any) => void) {

  const isCreate = dashboard.state === DashboardState.Create
  React.useEffect(() => {
    if (isCreate) {
      // If create mode, we might need to notify rendered too? 
      // But usually config is not fetched.
      return
    }
    // 初始化获取配置
    dashboard.getConfig().then(updateConfig).catch(e => {
      console.error("getConfig error", e);
      // Call updateConfig with empty to ensure flow continues?
      // updateConfig({}); 
    });
  }, []);


  React.useEffect(() => {
    const offConfigChange = dashboard.onConfigChange((r) => {
      // 监听配置变化，协同修改配置
      updateConfig(r.data);
    });
    return () => {
      offConfigChange();
    }
  }, []);
}