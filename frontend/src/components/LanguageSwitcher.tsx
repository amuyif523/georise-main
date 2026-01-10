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
      <div tabIndex={0} role="button" className="btn btn-ghost btn-sm gap-2 text-slate-300">
        <Globe className="w-4 h-4 text-cyan-400" />
        {i18n.language === 'am'
          ? 'አማርኛ'
          : i18n.language === 'om'
            ? 'Afaan Oromoo'
            : i18n.language === 'so'
              ? 'Soomaali'
              : 'English'}
      </div>
      <ul
        tabIndex={0}
        className="dropdown-content z-[1] menu p-2 shadow-2xl bg-[#0D1220] border border-slate-700 rounded-box w-52"
      >
        <li>
          <button
            className={`hover:bg-cyan-500/10 ${i18n.language === 'en' ? 'text-cyan-400 font-bold' : ''}`}
            onClick={() => changeLanguage('en')}
          >
            🇺🇸 {t('common.english')}
          </button>
        </li>
        <li>
          <button
            className={`hover:bg-cyan-500/10 ${i18n.language === 'am' ? 'text-cyan-400 font-bold' : ''}`}
            onClick={() => changeLanguage('am')}
          >
            🇪🇹 {t('common.amharic')}
          </button>
        </li>
        <li>
          <button
            className={`hover:bg-cyan-500/10 ${i18n.language === 'om' ? 'text-cyan-400 font-bold' : ''}`}
            onClick={() => changeLanguage('om')}
          >
            🇪🇹 {t('common.oromo')}
          </button>
        </li>
        <li>
          <button
            className={`hover:bg-cyan-500/10 ${i18n.language === 'so' ? 'text-cyan-400 font-bold' : ''}`}
            onClick={() => changeLanguage('so')}
          >
            🇸🇴 {t('common.somali')}
          </button>
        </li>
      </ul>
    </div>
  );
};

export default LanguageSwitcher;
