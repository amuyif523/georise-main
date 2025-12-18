import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

const LanguageSwitcher: React.FC = () => {
  const { i18n, t } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="dropdown dropdown-end">
      <div tabIndex={0} role="button" className="btn btn-ghost btn-sm gap-2">
        <Globe className="w-4 h-4" />
        {i18n.language === 'am' ? 'አማርኛ' : 'English'}
      </div>
      <ul
        tabIndex={0}
        className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52"
      >
        <li>
          <button
            className={i18n.language === 'en' ? 'active' : ''}
            onClick={() => changeLanguage('en')}
          >
            🇺🇸 {t('common.english')}
          </button>
        </li>
        <li>
          <button
            className={i18n.language === 'am' ? 'active' : ''}
            onClick={() => changeLanguage('am')}
          >
            🇪🇹 {t('common.amharic')}
          </button>
        </li>
      </ul>
    </div>
  );
};

export default LanguageSwitcher;
