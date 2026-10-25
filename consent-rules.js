/* Independently maintained UI rules. Sources and scope: docs/RESEARCH.md. */
(() => {
  'use strict';

  // Selectors are evaluated only inside a visible matching provider root.
  // A close/dismiss/secondary button is deliberately never a reject rule.
  const providers = [
    {
      id: 'onetrust',
      roots: ['#onetrust-banner-sdk', '#onetrust-pc-sdk'],
      reject: ['#onetrust-reject-all-handler', '.ot-pc-refuse-all-handler'],
      manage: ['#onetrust-pc-btn-handler'],
      save: ['.save-preference-btn-handler'],
      // Inactive hidden filter/master templates are not category selections.
      // Checked, mixed, visible or unknown controls must still block saving.
      ignoreUncheckedToggles: ['input#chkbox-id.category-filter-handler',
        'input#select-all-hosts-groups-handler', 'input#select-all-vendor-groups-handler',
        'input#select-all-vendor-leg-handler']
    },
    {
      id: 'cookiebot',
      roots: ['#CybotCookiebotDialog'],
      reject: ['#CybotCookiebotDialogBodyButtonDecline', '#CybotCookiebotDialogBodyLevelButtonLevelOptinDeclineAll'],
      manage: ['#CybotCookiebotDialogBodyEdgeMoreDetailsLink'],
      save: ['#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowallSelection']
    },
    {
      id: 'cookieyes',
      roots: ['.cky-consent-container', '.cky-preference-center', '[data-cky-tag="notice"]', '[data-cky-tag="detail"]'],
      reject: ['[data-cky-tag="reject-button"]', '[data-cky-tag="detail-reject-button"]', '.cky-btn-reject'],
      manage: ['[data-cky-tag="settings-button"]', '.cky-btn-customize'],
      save: ['[data-cky-tag="detail-save-button"]', '[data-cky-tag="detail-category-preview-save-button"]', '.cky-btn-preferences']
    },
    {
      id: 'cookieyes-legacy',
      roots: ['#cookie-law-info-bar', '#cliSettingsPopup'],
      reject: ['.wt-cli-reject-btn', '.cookie_action_close_header_reject'],
      manage: ['.cli_settings_button']
    },
    {
      id: 'consentmanager',
      roots: ['#cmpbox', '#cmpbox2'],
      reject: ['.cmpboxbtnno'],
      manage: ['.cmpboxbtnsettings'],
      save: ['.cmpboxbtnsave']
    },
    {
      id: 'iubenda',
      roots: ['#iubenda-cs-banner', '.iubenda-cs-container'],
      reject: ['.iubenda-cs-reject-btn', '.iubenda-cs-cwa-button'],
      manage: ['.iubenda-cs-customize-btn']
    },
    {
      id: 'klaro',
      roots: ['.klaro .cookie-notice', '.klaro .cookie-modal'],
      reject: ['.cn-decline', '.cm-btn-decline'],
      manage: ['.cm-btn-lern-more'],
      save: ['.cm-btn-accept:not(.cm-btn-accept-all)']
    },
    {
      id: 'tarteaucitron',
      roots: ['#tarteaucitronAlertBig', '#tarteaucitron'],
      reject: ['#tarteaucitronAllDenied', '#tarteaucitronAllDenied2'],
      manage: ['#tarteaucitronCloseAlert'],
      save: ['#tarteaucitronSaveButton']
    },
    {
      id: 'orestbida',
      roots: ['#cc-main .cm', '#cc-main .pm'],
      reject: ['button[data-role="necessary"]'],
      manage: ['button[data-role="show"]'],
      save: ['button[data-role="save"]']
    },
    {
      id: 'silktide',
      roots: ['#stcm-banner', '#stcm-modal'],
      reject: ['.stcm-reject-all', '.stcm-modal-reject-all'],
      manage: ['.stcm-preferences-button'],
      save: ['.stcm-modal-save']
    },
    {
      id: 'complianz',
      roots: ['.cmplz-cookiebanner'],
      reject: ['.cmplz-deny'],
      manage: ['.cmplz-view-preferences', '.cmplz-manage-settings'],
      save: ['.cmplz-save-preferences', '.cmplz-save-settings']
    },
    {
      id: 'osano-cookieconsent',
      roots: ['.cc-window'],
      reject: ['.cc-deny'],
      save: ['.cc-save']
    },
    {
      id: 'cookie-notice',
      roots: ['#cookie-notice'],
      reject: ['#cn-refuse-cookie', '.cn-set-cookie[data-cookie-set="refuse"]']
    },
    {
      id: 'moove-gdpr',
      roots: ['#moove_gdpr_cookie_info_bar', '#moove_gdpr_cookie_modal'],
      reject: ['.moove-gdpr-infobar-reject-btn', '.moove-gdpr-modal-reject-all'],
      manage: ['.change-settings-button'],
      save: ['.moove-gdpr-modal-save-settings']
    },
    {
      id: 'cookiefirst',
      roots: ['#cookiefirst-root', '.cookiefirst-root', '[data-cookiefirst-widget="modal"]'],
      reject: ['button[data-cookiefirst-action="reject"]', 'button[data-cookiefirst-action="reject_second"]'],
      manage: ['button[data-cookiefirst-action="adjust"]'],
      save: ['button[data-cookiefirst-action="save"]']
    },
    {
      id: 'didomi',
      roots: ['#didomi-notice', '#didomi-popup', '#didomi-host .didomi-popup-container'],
      reject: ['#didomi-notice-disagree-button', '#btn-toggle-disagree'],
      manage: ['#didomi-notice-learn-more-button']
    },
    {
      id: 'usercentrics',
      roots: ['#usercentrics-root'],
      reject: ['button[data-testid="uc-deny-all-button"]'],
      manage: ['button[data-testid="uc-more-button"]', 'button[data-testid="uc-customize-button"]'],
      save: ['button[data-testid="uc-save-button"]']
    },
    {
      id: 'osano',
      roots: ['.osano-cm-dialog', '.osano-cm-info-dialog'],
      reject: ['.osano-cm-button--type_denyAll', '.osano-cm-link--type_denyAll', '.osano-cm-button--type_deny'],
      manage: ['.osano-cm-manage'],
      save: ['.osano-cm-save']
    },
    {
      id: 'borlabs',
      roots: ['.brlbs-cmpnt-dialog', '.brlbs-cmpnt-dialog-box', '.brlbs-cmpnt-dialog-box-plus', '.brlbs-cmpnt-dialog-bar', '.brlbs-cmpnt-dialog-iab-tcf'],
      reject: ['.brlbs-btn-accept-only-essential']
    },
    {
      id: 'sourcepoint',
      roots: ['.sp_message_container', '.sp_message', '[class*="sp_choice_type_"]'],
      reject: ['.sp_choice_type_13', '.sp_choice_type_REJECT_ALL'],
      strictActions: true,
      accept: ['.sp_choice_type_11', '.sp_choice_type_ACCEPT_ALL'],
      manage: ['.sp_choice_type_12'],
      save: ['.sp_choice_type_SAVE_AND_EXIT', '.sp_choice_type_SE']
    },
    {
      "id": "cookiescript",
      "roots": [
        ".cookiescript_injected",
        ".cookiescript_fsd_wrapper",
        "#cookiescript_injected",
        "#cookiescript_injected_fsd"
      ],
      "reject": [
        "#cookiescript_reject"
      ],
      "accept": [
        "#cookiescript_accept"
      ],
      "manage": [
        "#cookiescript_manage"
      ],
      "save": [
        "#cookiescript_save"
      ]
    },
    {
      "id": "termly",
      "roots": [
        "[data-termly-part=\"consent-banner\"]",
        ".t-preference-modal"
      ],
      "reject": [
        "[data-tid=\"banner-decline\"]",
        ".t-declineAllButton"
      ],
      "accept": [
        "[data-tid=\"banner-accept\"]",
        ".t-allowAllButton"
      ],
      "save": [
        ".t-saveButton"
      ]
    },
    {
      "id": "trustarc",
      "roots": [
        "#truste-consent-track"
      ],
      "reject": [
        "#truste-consent-required"
      ],
      "accept": [
        "#truste-consent-button"
      ],
      "manage": [
        "#truste-show-consent"
      ]
    },
    {
      "id": "cookie-information",
      "roots": [
        "#coi-banner-wrapper"
      ],
      "reject": [
        "[data-testid=\"coi-banner__decline-all-categories-button\"]",
        "#declineButton"
      ],
      "accept": [
        "[data-testid=\"coi-banner__accept-all-categories-button\"]"
      ],
      "manage": [
        "[data-testid=\"coi-banner__settings-button\"]"
      ],
      "save": [
        "[data-testid=\"coi-banner__update-categories-button\"]",
        "#updateButton"
      ]
    },
    {
      "id": "securiti",
      "roots": [
        ".f-pref-sdk-banner"
      ],
      "reject": [
        ".cmp-decline-btn"
      ],
      "save": [
        ".cmp-save-btn"
      ]
    },
    {
      "id": "axeptio-tcf",
      "roots": [
        ".modal-dialog[role=\"dialog\"]:has(#axeptio_btn_dismiss)"
      ],
      "reject": [
        "#axeptio_btn_dismiss"
      ],
      "accept": [
        "#axeptio_btn_acceptAll",
        "#axeptio_btn_config_acceptAll"
      ]
    },
    {
      "id": "orejime",
      "roots": [
        ".orejime-Banner",
        ".orejime-Notice"
      ],
      "reject": [
        "button.orejime-Banner-declineButton",
        "button.orejime-Notice-declineButton"
      ],
      "manage": [
        "button.orejime-Banner-learnMoreButton",
        "button.orejime-Notice-learnMoreButton"
      ]
    },
    {
      "id": "drupal-eu-cookie-compliance",
      "roots": [
        "#sliding-popup:has(.eu-cookie-compliance-banner)",
        ".eu-cookie-compliance-banner"
      ],
      "reject": [
        "button.decline-button",
        "button.eu-cookie-compliance-reject-button"
      ],
      "save": [
        "button.eu-cookie-compliance-save-preferences-button"
      ]
    },
    {
      "id": "civic-cookiecontrol",
      "roots": [
        "#ccc-notify"
      ],
      "reject": [
        "button#ccc-notify-reject"
      ]
    },
    {
      "id": "orestbida-v2",
      "roots": [
        "#cc_div #cm",
        "#cc_div #s-cnt"
      ],
      "reject": [
        "button#s-rall-bn",
        "button[data-cc=\"accept-necessary\"]"
      ],
      "manage": [
        "button[data-cc=\"c-settings\"]"
      ],
      "save": [
        "button#s-sv-bn"
      ]
    },
    {
      "id": "glowcookies",
      "roots": [
        "#glowCookies-banner"
      ],
      "reject": [
        "button#rejectCookies"
      ]
    },
    {
      "id": "brainsum-cookieconsent",
      "roots": [
        "#cconsent-bar",
        "#cconsent-modal",
        "#cconsent-init-modal"
      ],
      "reject": [
        "button.consent-decline"
      ],
      "manage": [
        "button.ccb__edit",
        "button.ccm__edit"
      ],
      "save": [
        "button#ccm__footer__consent-modal-submit"
      ]
    },
    {
      "id": "metamorfosilab-cookies-consent",
      "roots": [
        "#cc-window"
      ],
      "reject": [
        "button#cc-btn-reject"
      ],
      "manage": [
        "button#cc-btn-settings"
      ]
    },
    {
      "id": "bootstrap-cookie-consent-manager",
      "roots": [
        "#cookie-consent-manager-banner",
        "#cookie-consent-manager-modal"
      ],
      "reject": [
        "button[data-cookie-button-function=\"reject-all-cookies\"]"
      ],
      "manage": [
        "button[data-cookie-button-function=\"customize-cookies\"]"
      ],
      "save": [
        "button[data-cookie-button-function=\"save-cookies\"]"
      ]
    }
  ];

  function normalizeLabel(value) {
    return String(value || '').normalize('NFKC').toLowerCase()
      .replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u206f]/g, '')
      .replace(/\u00ad/g, '')
      .replace(/[\u2010-\u2015\u2212]/g, '-')
      .replace(/[’‘]/g, "'")
      .replace(/\s+/gu, ' ').trim()
      .replace(/[.!?…:;،。！？：；]+$/u, '').trim();
  }

  // Hand-maintained phrases, not substring expressions. These action labels are
  // meaningful only after the engine has established a cookie-consent context.
  // Categories (necessary/optional) and context terms are not action labels.
  const labels = {
    reject: [
      'reject', 'reject all', 'reject all cookies', 'reject cookies', 'reject optional cookies', 'reject non-essential',
      'reject non-essential cookies', 'reject all non-essential cookies', 'decline', 'decline all', 'deny', 'deny all',
      'deny cookies', 'refuse', 'refuse all', 'refuse cookies', 'i decline', 'no thanks', 'no, thanks', 'no thank you', 'no, thank you', 'continue without accepting',
      'reject all additional cookies', 'reject additional cookies', 'reject nonessential cookies',
      'accept only essential cookies', 'allow only essential cookies', 'allow essential cookies only',
      'continue without consent', 'continue without consenting', 'disagree and close',
      'continue without agreeing', 'do not accept', 'do not consent', 'only necessary', 'necessary only',
      'essential only', 'only essential cookies', 'accept necessary', 'accept necessary only', 'accept only necessary',
      'accept only necessary cookies', 'use necessary cookies only', 'allow necessary cookies only', 'save necessary cookies only',
      'alle ablehnen', 'alles ablehnen', 'ablehnen', 'nur notwendige', 'nur notwendige cookies', 'nur erforderliche cookies',
      'nur essenzielle cookies', 'nur technisch notwendige cookies', 'ohne zustimmung fortfahren',
      'tout refuser', 'refuser', 'refuser tout', 'continuer sans accepter', 'uniquement les cookies nécessaires',
      'cookies nécessaires uniquement', 'accepter uniquement les cookies nécessaires',
      'rechazar', 'rechazar todo', 'rechazar todas', 'rechazar todas las cookies', 'solo necesarias',
      'solo cookies necesarias', 'aceptar solo las necesarias', 'continuar sin aceptar',
      'rifiuta', 'rifiuta tutto', 'rifiuta tutti', 'solo necessari', 'solo cookie necessari', 'continua senza accettare',
      'rejeitar', 'rejeitar todos', 'rejeitar tudo', 'recusar', 'recusar todos', 'apenas necessários',
      'apenas cookies necessários', 'aceitar apenas os necessários', 'continuar sem aceitar',
      'alles weigeren', 'alle weigeren', 'weigeren', 'alleen noodzakelijke cookies', 'alleen noodzakelijk',
      'odrzuć', 'odrzuć wszystkie', 'odrzuć wszystko', 'tylko niezbędne', 'tylko niezbędne pliki cookie',
      'odmítnout', 'odmítnout vše', 'pouze nezbytné', 'pouze nezbytné soubory cookie',
      'odmietnuť', 'odmietnuť všetko', 'iba nevyhnutné', 'iba nevyhnutné súbory cookie',
      'afvis', 'afvis alle', 'kun nødvendige', 'kun nødvendige cookies',
      'avvisa', 'avvisa alla', 'neka', 'neka alla', 'endast nödvändiga', 'endast nödvändiga cookies',
      'avvis', 'avvis alle', 'bare nødvendige', 'kun nødvendige informasjonskapsler',
      'hylkää', 'hylkää kaikki', 'vain välttämättömät', 'vain välttämättömät evästeet',
      'απόρριψη', 'απόρριψη όλων', 'μόνο απαραίτητα', 'μόνο απαραίτητα cookies',
      'respinge', 'respinge toate', 'refuză toate', 'doar cele necesare', 'doar cookie-uri necesare',
      'elutasítás', 'összes elutasítása', 'csak a szükségesek', 'csak szükséges sütik',
      'отхвърляне', 'отхвърляне на всички', 'само необходимите',
      'odbij', 'odbij sve', 'samo nužni', 'samo nužni kolačići',
      'zavrni', 'zavrni vse', 'samo nujni', 'samo nujni piškotki',
      'keeldu', 'keeldu kõigist', 'ainult vajalikud', 'ainult vajalikud küpsised',
      'noraidīt', 'noraidīt visus', 'tikai nepieciešamās', 'tikai nepieciešamās sīkdatnes',
      'atmesti', 'atmesti visus', 'tik būtini', 'tik būtinieji slapukai',
      'reddet', 'tümünü reddet', 'hepsini reddet', 'yalnızca gerekli çerezler', 'sadece gerekli çerezler',
      'отклонить', 'отклонить все', 'отказаться от всех', 'только необходимые',
      'відхилити', 'відхилити всі', 'лише необхідні',
      'رفض', 'رفض الكل', 'رفض جميع ملفات تعريف الارتباط', 'الضرورية فقط',
      'דחה', 'דחה הכל', 'דחיית הכל', 'רק הכרחיים',
      '拒绝', '全部拒绝', '拒绝所有', '仅必要', '仅必要的 cookie', '拒絕', '全部拒絕', '僅限必要',
      'すべて拒否', '全て拒否', '拒否する', '必要な cookie のみ', '必要なクッキーのみ',
      '모두 거부', '거부', '필수 쿠키만',
      'अस्वीकार करें', 'सभी अस्वीकार करें', 'केवल आवश्यक',
      'tolak', 'tolak semua', 'hanya yang diperlukan', 'hanya kuki yang diperlukan',
      'từ chối', 'từ chối tất cả', 'chỉ cookie cần thiết'
    ],
    manage: [
      'manage preferences', 'manage cookie preferences', 'manage cookies', 'cookie settings', 'cookie preferences',
      'customise', 'customize', 'customise cookies', 'customize cookies', 'customize settings', 'manage options',
      'more options', 'privacy settings', 'change settings', 'settings', 'preferences',
      'einstellungen', 'cookie-einstellungen', 'einstellungen verwalten', 'auswahl anpassen',
      'personnaliser', 'paramétrer', 'gérer mes choix', 'gérer les préférences', 'paramètres des cookies',
      'configurar', 'personalizar', 'gestionar preferencias', 'configuración de cookies',
      'personalizza', 'gestisci preferenze', 'impostazioni cookie',
      'gerir preferências', 'gerenciar preferências', 'configurações de cookies',
      'voorkeuren beheren', 'instellingen', 'cookie-instellingen',
      'ustawienia', 'zarządzaj preferencjami', 'dostosuj',
      'nastavení', 'upravit nastavení', 'nastavenia', 'prispôsobiť',
      'indstillinger', 'tilpas', 'inställningar', 'anpassa', 'innstillinger', 'tilpass', 'asetukset', 'mukauta',
      'ρυθμίσεις', 'προσαρμογή', 'setări', 'personalizare', 'beállítások', 'testreszabás',
      'настройки', 'персонализиране', 'postavke', 'prilagodi', 'nastavitve', 'prilagodi nastavitve',
      'seaded', 'kohanda', 'iestatījumi', 'pielāgot', 'nustatymai', 'tinkinti',
      'ayarlar', 'özelleştir', 'настроить', 'налаштування', 'налаштувати',
      'الإعدادات', 'تخصيص', 'הגדרות', 'התאמה אישית', '设置', '自定义', '設定', '自訂',
      '設定する', 'カスタマイズ', '설정', '맞춤 설정', 'सेटिंग', 'अनुकूलित करें',
      'pengaturan', 'sesuaikan', 'cài đặt', 'tùy chỉnh'
    ],
    save: [
      'save preferences', 'save my preferences', 'save settings', 'save choices', 'confirm choices', 'confirm selection',
      'confirm my choices', 'save and close', 'save and continue', 'accept selected', 'accept selection', 'allow selection',
      'auswahl speichern', 'einstellungen speichern', 'auswahl bestätigen',
      'enregistrer mes choix', 'enregistrer les préférences', 'confirmer mes choix', 'valider mes choix',
      'guardar preferencias', 'guardar configuración', 'confirmar selección', 'salva preferenze', 'salva impostazioni',
      'conferma le mie scelte', 'salvar preferências', 'guardar preferências', 'salvar configurações',
      'voorkeuren opslaan', 'selectie opslaan', 'zapisz preferencje', 'zapisz ustawienia', 'zapisz wybór',
      'uložit nastavení', 'uložit výběr', 'uložiť nastavenia', 'uložiť výber',
      'gem indstillinger', 'gem valg', 'spara inställningar', 'spara val', 'lagre innstillinger', 'lagre valg',
      'tallenna asetukset', 'tallenna valinnat', 'αποθήκευση προτιμήσεων', 'salvează preferințele',
      'beállítások mentése', 'запазване на настройките', 'spremi postavke', 'shrani nastavitve',
      'salvesta eelistused', 'saglabāt iestatījumus', 'išsaugoti nustatymus', 'tercihleri kaydet',
      'сохранить настройки', 'сохранить выбор', 'зберегти налаштування', 'حفظ التفضيلات', 'שמירת העדפות',
      '保存设置', '保存偏好', '儲存設定', '設定を保存', '선택 저장', '설정 저장',
      'प्राथमिकताएं सहेजें', 'simpan preferensi', 'lưu tùy chọn'
    ],
    accept: [
      'accept', 'accept all', 'accept all cookies', 'allow all', 'allow all cookies', 'agree', 'agree to all', 'i agree',
      'agree and close', 'consent', 'yes', 'ok', 'okay', 'got it',
      'akzeptieren', 'alle akzeptieren', 'alles akzeptieren', 'zustimmen', 'tout accepter', 'accepter', "j'accepte",
      'aceptar', 'aceptar todo', 'aceptar todas', 'accetta', 'accetta tutto', 'aceitar', 'aceitar todos',
      'accepteren', 'alles accepteren', 'akceptuj', 'akceptuj wszystkie', 'přijmout', 'přijmout vše',
      'prijať', 'prijať všetko', 'accepter alle', 'acceptera alla', 'godta alle', 'hyväksy kaikki',
      'αποδοχή όλων', 'acceptă toate', 'összes elfogadása', 'приемане на всички',
      'prihvati sve', 'sprejmi vse', 'nõustu kõigiga', 'piekrist visām', 'priimti visus',
      'tümünü kabul et', 'принять все', 'прийняти всі', 'قبول الكل', 'אישור הכל',
      '全部接受', '接受所有', '全部同意', 'すべて同意', 'すべて許可', '모두 동의', 'सभी स्वीकार करें',
      'terima semua', 'chấp nhận tất cả'
    ],
    necessary: [
      'strictly necessary', 'strictly necessary cookies', 'necessary', 'necessary cookies', 'essential', 'essential cookies',
      'required', 'required cookies', 'always active',
      'notwendig', 'erforderlich', 'essenziell', 'unbedingt erforderlich', 'technisch notwendig',
      'nécessaire', 'nécessaires', 'essentiel', 'obligatoire', 'necesarias', 'necesarios', 'esenciales',
      'necessari', 'necessarie', 'necessários', 'essenciais', 'noodzakelijk', 'essentieel', 'niezbędne', 'wymagane',
      'nezbytné', 'nevyhnutné', 'nødvendige', 'nödvändiga', 'välttämättömät', 'απαραίτητα', 'αναγκαία',
      'necesare', 'esențiale', 'szükséges', 'elengedhetetlen', 'необходими', 'задължителни', 'nužni',
      'obavezni', 'nujni', 'obvezni', 'vajalikud', 'hädavajalikud', 'nepieciešamās', 'būtini', 'būtinieji',
      'gerekli', 'zorunlu', 'необходимые', 'обязательные', 'необхідні', 'обов’язкові', 'ضرورية', 'الضرورية',
      'הכרחיים', 'חיוניים', '必要', '必需', '必須', '필수', 'आवश्यक', 'diperlukan', 'esensial', 'cần thiết'
    ],
    optional: [
      'optional', 'optional cookies', 'non-essential', 'non-essential cookies',
      'analytics', 'analytics cookies', 'analytical', 'analytical cookies', 'statistics', 'statistics cookies',
      'advertising', 'advertising cookies', 'marketing', 'marketing cookies', 'functional cookies', 'performance cookies',
      'personalization cookies', 'personalisation cookies', 'targeting cookies', 'advertising and marketing',
      'personalization', 'personalisation', 'functional', 'performance', 'legitimate interest', 'legitimate interests',
      'statistik', 'analyse', 'werbung', 'personalisierung', 'berechtigtes interesse', 'funktional',
      'statistiques', 'publicité', 'personnalisation', 'intérêt légitime', 'facultatif',
      'estadísticas', 'publicidad', 'personalización', 'interés legítimo', 'analitici', 'pubblicità',
      'personalizzazione', 'interesse legittimo', 'estatísticas', 'publicidade', 'personalização',
      'statistieken', 'advertenties', 'statystyka', 'reklamowe', 'analityczne', 'statistiky', 'reklamní',
      'štatistiky', 'reklamné', 'statistikker', 'markedsføring', 'statistikcookies', 'annonsering',
      'tilastot', 'mainonta', 'στατιστικά', 'διαφήμιση', 'statistici', 'publicitate', 'statisztikai', 'hirdetési',
      'статистически', 'рекламни', 'analitika', 'oglašavanje', 'statistični', 'trženje', 'statistika',
      'turundus', 'mārketings', 'statistiniai', 'rinkodaros', 'istatistik', 'reklam', 'analiz',
      'статистика', 'рекламные', 'маркетинг', 'статистичні', 'рекламні', 'إحصائية', 'التسويق',
      'الإعلانات', 'שיווק', 'פרסום', '统计', '廣告', '广告', '分析', '行銷', '营销',
      '広告', 'マーケティング', '통계', '광고', '마케팅', 'विश्लेषण', 'विज्ञापन', 'statistik', 'iklan', 'quảng cáo'
    ],
    cookieContext: [
      'cookie', 'cookies', 'tracking technologies', 'tracking preferences', 'tracking cookies',
      'tracking-einstellungen', 'technologies de traçage', 'préférences de suivi', 'traceurs',
      'tecnologías de seguimiento', 'tecnologie di tracciamento', 'tecnologias de rastreamento',
      'ciasteczka', 'ciasteczek', 'pliki cookie', 'soubory cookie', 'súbory cookie',
      'eväste', 'evästeet', 'evästeitä', 'informasjonskaps', 'informasjonskapsler',
      'sütik', 'sütiket', 'бисквитк', 'kolačić', 'kolačići', 'piškot', 'piškotki',
      'küpsis', 'küpsised', 'küpsiste', 'sīkdat', 'sīkdatnes', 'slapuk', 'slapukai',
      'çerez', 'çerezler', 'çerezleri', 'куки', 'файлы cookie', 'файли cookie',
      'ملفات تعريف الارتباط', 'עוגיות', 'クッキー', '쿠키', 'कुकी', 'kuki'
    ],
    consent: [
      'cookie', 'cookies', 'consent', 'tracking technologies', 'privacy preferences', 'privacy choices',
      'tracking preferences', 'data processing', 'einstellungen zum datenschutz', 'datenschutzeinstellungen',
      'einwilligung', 'consentement', 'traceurs', 'confidentialité', 'consentimiento', 'privacidad',
      'consenso', 'riservatezza', 'consentimento', 'privacidade', 'toestemming', 'zgoda', 'ciasteczka',
      'pliki cookie', 'souhlas', 'soubory cookie', 'súhlas', 'samtykke', 'samtycke', 'suostumus', 'eväste',
      'informasjonskaps', 'συγκατάθεση', 'απόρρητο', 'consimțământ', 'sütik', 'hozzájárulás',
      'бисквитки', 'съгласие', 'kolačić', 'privola', 'piškot', 'soglasje', 'küpsis', 'küpsised',
      'sīkdat', 'slapuk', 'çerez', 'gizlilik', 'файлы cookie', 'куки', 'конфиденциальност',
      'файли cookie', 'згода', 'ملفات تعريف الارتباط', 'الخصوصية', 'עוגיות', 'פרטיות',
      '隐私', '隱私', 'クッキー', 'プライバシー', '쿠키', '개인정보', 'कुकी', 'गोपनीयता',
      'kuki', 'persetujuan', 'quyền riêng tư'
    ]
  };

  for (const category of Object.keys(labels)) {
    labels[category] = Object.freeze([...new Set(labels[category].map(normalizeLabel))]);
  }
  const actionKinds = ['reject', 'manage', 'save', 'accept', 'necessary'];
  const labelSets = new Map(actionKinds.map(kind => [kind, new Set(labels[kind])]));
  function classifyLabel(text) {
    const value = normalizeLabel(text);
    if (!value) return null;
    for (const kind of actionKinds) {
      if (labelSets.get(kind).has(value)) return kind;
    }
    return null;
  }

  for (const provider of providers) {
    for (const field of ['roots', 'reject', 'accept', 'manage', 'save', 'ignoreUncheckedToggles']) {
      if (provider[field]) Object.freeze(provider[field]);
    }
    Object.freeze(provider);
  }
  globalThis.CookieConsentRules = Object.freeze({
    version: 1,
    providers: Object.freeze(providers),
    labels: Object.freeze(labels),
    normalizeLabel,
    classifyLabel
  });
})();
