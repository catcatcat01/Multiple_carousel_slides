import { ReactElement, useEffect, useState, Component, ErrorInfo } from "react"
import { bitable } from "@lark-base-open/js-sdk"
import './style.css'
import '../../locales/i18n';
import { LocaleProvider } from '@douyinfe/semi-ui';
import dayjs from 'dayjs';
import zh_CN from '@douyinfe/semi-ui/lib/es/locale/source/zh_CN';
import en_US from '@douyinfe/semi-ui/lib/es/locale/source/en_US';
import ja_JP from '@douyinfe/semi-ui/lib/es/locale/source/ja_JP';

dayjs.locale('en-us');

class ErrorBoundary extends Component<{ children: ReactElement }, { hasError: boolean, error: any }> {
  constructor(props: { children: ReactElement }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="errTop">
          <h3>Something went wrong.</h3>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
            {this.state.error?.toString()}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function LoadApp(props: { children: ReactElement }): ReactElement {
  const [locale, setLocale] = useState(en_US);

  useEffect(() => {
    bitable.bridge.getLanguage().then((v) => {
      if (v === 'zh') {
        setLocale(zh_CN);
        dayjs.locale('zh-cn');
      }

      if (v === 'ja') {
        setLocale(ja_JP);
      }

    }).catch((e) => {
      console.error(e);
    })
  }, [])

  return <div>
    <ErrorBoundary>
      <LocaleProvider locale={locale}>
        {props.children}
      </LocaleProvider>
    </ErrorBoundary>
  </div>
}

