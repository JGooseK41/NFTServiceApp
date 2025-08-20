// Multi-language support for BlockServed interface
const translations = {
    en: {
        name: "English",
        flag: "🇺🇸",
        blockserved: {
            // Main titles and navigation
            title: "📬 You Have a Legal Document",
            subtitle: "Someone has sent you an important document that requires your attention",
            selectLanguage: "Select Language",
            warningMessage: "Ignoring legal notices can result in default judgment against you",
            refresh: "Refresh",
            connectRefresh: "Connect & Refresh",
            
            // Connection section
            connectWallet: "Connect Wallet",
            connecting: "Connecting...",
            walletConnected: "Wallet Connected",
            connectionError: "Connection Error",
            switchNetwork: "Switch to TRON Network",
            installWallet: "Install TronLink Wallet",
            unlockWallet: "Please unlock and connect your wallet",
            
            // Search section
            searchTitle: "Find Your Legal Notices",
            searchDescription: "Enter your wallet address or connect your wallet to view notices",
            searchPlaceholder: "Enter TRON wallet address (T...)",
            searchButton: "Search Notices",
            orText: "OR",
            
            // Notice display
            myNotices: "My Legal Notices",
            noNotices: "No legal notices found for this address",
            noticeFrom: "From",
            noticeType: "Type",
            caseNumber: "Case #",
            dateIssued: "Date Issued",
            deadline: "Response Deadline",
            status: "Status",
            pending: "Pending - Action Required",
            accepted: "Accepted",
            expired: "Expired",
            viewNotice: "View Notice",
            
            // Notice details modal
            legalNoticeDetails: "Legal Notice Details",
            issuingAgency: "Issuing Agency",
            noticeInformation: "Notice Information",
            documentType: "Document Type",
            caseDetails: "Case Details",
            legalRights: "Your Legal Rights",
            responseRequired: "Response Required By",
            attachedDocument: "Attached Document",
            
            // Accept notice
            acceptNotice: "Accept Notice",
            acceptanceRequired: "Acceptance Required",
            acceptanceInstructions: "By clicking 'Accept Notice', you acknowledge receipt of this legal document. This is equivalent to signing for certified mail.",
            acceptanceWarning: "Your signature confirms receipt only, not agreement with the contents.",
            transactionFee: "Transaction Fee",
            feeSponsored: "Fee Sponsored - No charge to you",
            processing: "Processing...",
            
            // Success/Error messages
            noticeAccepted: "Notice Successfully Accepted",
            acceptanceRecorded: "Your acceptance has been recorded on the blockchain",
            viewDocument: "View Document",
            downloadDocument: "Download Document",
            errorAccepting: "Error Accepting Notice",
            errorLoading: "Error Loading Notices",
            tryAgain: "Try Again",
            
            // Document viewer
            documentViewer: "Document Viewer",
            documentEncrypted: "This document is encrypted for your privacy",
            decrypting: "Decrypting document...",
            print: "Print",
            download: "Download",
            close: "Close",
            
            // Help section
            helpTitle: "How It Works",
            helpStep1: "Connect your TRON wallet or enter your address",
            helpStep2: "View all legal notices sent to your address",
            helpStep3: "Click 'Accept Notice' to acknowledge receipt",
            helpStep4: "Access and download your documents",
            helpNote: "Note: Acceptance fees are sponsored - you pay nothing",
            
            // Footer
            securedBy: "Secured by TRON Blockchain",
            privacyProtected: "Your privacy is protected with end-to-end encryption",
            
            // Info Cards
            safeSecure: "Safe & Secure",
            safeSecureDesc: "Your document is encrypted and can only be viewed by you. We never ask for money or private keys.",
            timeSensitive: "Time Sensitive",
            timeSensitiveDesc: "Legal notices have strict deadlines. View your document now to understand what action may be required.",
            digitalSignature: "Digital Signature",
            digitalSignatureDesc: "Accepting creates a legal record of receipt - just like signing for certified mail. It's free and takes 2 minutes.",
            
            // How It Works
            howItWorks: "How It Works",
            step1Title: "Connect Your Wallet",
            step1Desc: "Use the wallet that received the notice (check your NFTs)",
            step2Title: "View Your Notice",
            step2Desc: "See the legal document details and who sent it",
            step3Title: "Accept to Download",
            step3Desc: "Sign to decrypt and download the full document",
            step4Title: "Take Action",
            step4Desc: "Review the document and respond by any deadlines",
            
            // FAQ Preview
            commonQuestions: "Common Questions",
            faq1Question: "Q: Does accepting mean I agree with the notice?",
            faq1Answer: "A: No! Accepting only confirms you received it, like signing for mail.",
            faq2Question: "Q: What if I ignore this?",
            faq2Answer: "A: You risk default judgment, asset seizure, and loss of legal rights.",
            faq3Question: "Q: Is this free?",
            faq3Answer: "A: Yes! The sender included 2 TRX to cover all fees.",
            viewFullFAQ: "View Full FAQ",
            
            // Critical Warning Banner
            criticalWarning: "CRITICAL LEGAL WARNING",
            officialDocument: "You have received an official legal document that requires your immediate attention.",
            failureConsequences: "Failure to accept and respond to this notice may result in:",
            defaultJudgment: "DEFAULT JUDGMENT against you",
            propertySeizure: "PROPERTY SEIZURE or asset forfeiture",
            lossOfRights: "LOSS OF LEGAL RIGHTS to contest the action",
            criminalCharges: "CRIMINAL CHARGES for failure to comply",
            abandonRights: "By ignoring this notice, you may PERMANENTLY ABANDON YOUR RIGHTS to defend yourself."
        }
    },
    
    es: {
        name: "Español",
        flag: "🇪🇸",
        blockserved: {
            // Main titles and navigation
            title: "📬 Tiene un Documento Legal",
            subtitle: "Alguien le ha enviado un documento importante que requiere su atención",
            selectLanguage: "Seleccionar Idioma",
            warningMessage: "Ignorar las notificaciones legales puede resultar en un juicio en rebeldía en su contra",
            refresh: "Actualizar",
            connectRefresh: "Conectar y Actualizar",
            
            // Connection section
            connectWallet: "Conectar Cartera",
            connecting: "Conectando...",
            walletConnected: "Cartera Conectada",
            connectionError: "Error de Conexión",
            switchNetwork: "Cambiar a la Red TRON",
            installWallet: "Instalar Cartera TronLink",
            unlockWallet: "Por favor desbloquee y conecte su cartera",
            
            // Search section
            searchTitle: "Encuentre Sus Notificaciones Legales",
            searchDescription: "Ingrese su dirección de cartera o conecte su cartera para ver notificaciones",
            searchPlaceholder: "Ingrese dirección de cartera TRON (T...)",
            searchButton: "Buscar Notificaciones",
            orText: "O",
            
            // Notice display
            myNotices: "Mis Notificaciones Legales",
            noNotices: "No se encontraron notificaciones legales para esta dirección",
            noticeFrom: "De",
            noticeType: "Tipo",
            caseNumber: "Caso #",
            dateIssued: "Fecha de Emisión",
            deadline: "Fecha Límite de Respuesta",
            status: "Estado",
            pending: "Pendiente - Acción Requerida",
            accepted: "Aceptada",
            expired: "Expirada",
            viewNotice: "Ver Notificación",
            
            // Notice details modal
            legalNoticeDetails: "Detalles de la Notificación Legal",
            issuingAgency: "Agencia Emisora",
            noticeInformation: "Información de la Notificación",
            documentType: "Tipo de Documento",
            caseDetails: "Detalles del Caso",
            legalRights: "Sus Derechos Legales",
            responseRequired: "Respuesta Requerida Antes del",
            attachedDocument: "Documento Adjunto",
            
            // Accept notice
            acceptNotice: "Aceptar Notificación",
            acceptanceRequired: "Aceptación Requerida",
            acceptanceInstructions: "Al hacer clic en 'Aceptar Notificación', usted reconoce haber recibido este documento legal. Esto es equivalente a firmar por correo certificado.",
            acceptanceWarning: "Su firma confirma solo la recepción, no el acuerdo con el contenido.",
            transactionFee: "Tarifa de Transacción",
            feeSponsored: "Tarifa Patrocinada - Sin costo para usted",
            processing: "Procesando...",
            
            // Success/Error messages
            noticeAccepted: "Notificación Aceptada Exitosamente",
            acceptanceRecorded: "Su aceptación ha sido registrada en la blockchain",
            viewDocument: "Ver Documento",
            downloadDocument: "Descargar Documento",
            errorAccepting: "Error al Aceptar la Notificación",
            errorLoading: "Error al Cargar Notificaciones",
            tryAgain: "Intentar de Nuevo",
            
            // Document viewer
            documentViewer: "Visor de Documentos",
            documentEncrypted: "Este documento está encriptado para su privacidad",
            decrypting: "Desencriptando documento...",
            print: "Imprimir",
            download: "Descargar",
            close: "Cerrar",
            
            // Help section
            helpTitle: "Cómo Funciona",
            helpStep1: "Conecte su cartera TRON o ingrese su dirección",
            helpStep2: "Vea todas las notificaciones legales enviadas a su dirección",
            helpStep3: "Haga clic en 'Aceptar Notificación' para confirmar recepción",
            helpStep4: "Acceda y descargue sus documentos",
            helpNote: "Nota: Las tarifas de aceptación están patrocinadas - usted no paga nada",
            
            // Footer
            securedBy: "Asegurado por Blockchain TRON",
            privacyProtected: "Su privacidad está protegida con encriptación de extremo a extremo"
        }
    },
    
    fr: {
        name: "Français",
        flag: "🇫🇷",
        blockserved: {
            // Main titles and navigation
            title: "📬 Vous Avez un Document Juridique",
            subtitle: "Quelqu'un vous a envoyé un document important qui nécessite votre attention",
            selectLanguage: "Sélectionner la Langue",
            warningMessage: "Ignorer les notifications juridiques peut entraîner un jugement par défaut contre vous",
            refresh: "Actualiser",
            connectRefresh: "Connecter et Actualiser",
            
            // Connection section
            connectWallet: "Connecter le Portefeuille",
            connecting: "Connexion...",
            walletConnected: "Portefeuille Connecté",
            connectionError: "Erreur de Connexion",
            switchNetwork: "Passer au Réseau TRON",
            installWallet: "Installer le Portefeuille TronLink",
            unlockWallet: "Veuillez déverrouiller et connecter votre portefeuille",
            
            // Search section
            searchTitle: "Trouvez Vos Notifications Juridiques",
            searchDescription: "Entrez votre adresse de portefeuille ou connectez votre portefeuille pour voir les notifications",
            searchPlaceholder: "Entrez l'adresse du portefeuille TRON (T...)",
            searchButton: "Rechercher les Notifications",
            orText: "OU",
            
            // Notice display
            myNotices: "Mes Notifications Juridiques",
            noNotices: "Aucune notification juridique trouvée pour cette adresse",
            noticeFrom: "De",
            noticeType: "Type",
            caseNumber: "Dossier #",
            dateIssued: "Date d'Émission",
            deadline: "Date Limite de Réponse",
            status: "Statut",
            pending: "En Attente - Action Requise",
            accepted: "Acceptée",
            expired: "Expirée",
            viewNotice: "Voir la Notification",
            
            // Notice details modal
            legalNoticeDetails: "Détails de la Notification Juridique",
            issuingAgency: "Organisme Émetteur",
            noticeInformation: "Informations sur la Notification",
            documentType: "Type de Document",
            caseDetails: "Détails du Dossier",
            legalRights: "Vos Droits Légaux",
            responseRequired: "Réponse Requise Avant le",
            attachedDocument: "Document Joint",
            
            // Accept notice
            acceptNotice: "Accepter la Notification",
            acceptanceRequired: "Acceptation Requise",
            acceptanceInstructions: "En cliquant sur 'Accepter la Notification', vous reconnaissez avoir reçu ce document juridique. Ceci équivaut à signer pour un courrier recommandé.",
            acceptanceWarning: "Votre signature confirme uniquement la réception, pas l'accord avec le contenu.",
            transactionFee: "Frais de Transaction",
            feeSponsored: "Frais Parrainés - Aucun frais pour vous",
            processing: "Traitement...",
            
            // Success/Error messages
            noticeAccepted: "Notification Acceptée avec Succès",
            acceptanceRecorded: "Votre acceptation a été enregistrée sur la blockchain",
            viewDocument: "Voir le Document",
            downloadDocument: "Télécharger le Document",
            errorAccepting: "Erreur lors de l'Acceptation de la Notification",
            errorLoading: "Erreur lors du Chargement des Notifications",
            tryAgain: "Réessayer",
            
            // Document viewer
            documentViewer: "Visionneuse de Documents",
            documentEncrypted: "Ce document est crypté pour votre confidentialité",
            decrypting: "Décryptage du document...",
            print: "Imprimer",
            download: "Télécharger",
            close: "Fermer",
            
            // Help section
            helpTitle: "Comment ça Marche",
            helpStep1: "Connectez votre portefeuille TRON ou entrez votre adresse",
            helpStep2: "Consultez toutes les notifications juridiques envoyées à votre adresse",
            helpStep3: "Cliquez sur 'Accepter la Notification' pour confirmer la réception",
            helpStep4: "Accédez et téléchargez vos documents",
            helpNote: "Note: Les frais d'acceptation sont parrainés - vous ne payez rien",
            
            // Footer
            securedBy: "Sécurisé par la Blockchain TRON",
            privacyProtected: "Votre confidentialité est protégée par un cryptage de bout en bout"
        }
    },
    
    zh: {
        name: "中文",
        flag: "🇨🇳",
        blockserved: {
            // Main titles and navigation
            title: "📬 您有一份法律文件",
            subtitle: "有人给您发送了一份需要您关注的重要文件",
            selectLanguage: "选择语言",
            warningMessage: "忽视法律通知可能导致对您的缺席判决",
            refresh: "刷新",
            connectRefresh: "连接并刷新",
            
            // Connection section
            connectWallet: "连接钱包",
            connecting: "连接中...",
            walletConnected: "钱包已连接",
            connectionError: "连接错误",
            switchNetwork: "切换到TRON网络",
            installWallet: "安装TronLink钱包",
            unlockWallet: "请解锁并连接您的钱包",
            
            // Search section
            searchTitle: "查找您的法律通知",
            searchDescription: "输入您的钱包地址或连接钱包以查看通知",
            searchPlaceholder: "输入TRON钱包地址 (T...)",
            searchButton: "搜索通知",
            orText: "或",
            
            // Notice display
            myNotices: "我的法律通知",
            noNotices: "未找到此地址的法律通知",
            noticeFrom: "来自",
            noticeType: "类型",
            caseNumber: "案件编号",
            dateIssued: "发布日期",
            deadline: "回复截止日期",
            status: "状态",
            pending: "待处理 - 需要采取行动",
            accepted: "已接受",
            expired: "已过期",
            viewNotice: "查看通知",
            
            // Notice details modal
            legalNoticeDetails: "法律通知详情",
            issuingAgency: "发布机构",
            noticeInformation: "通知信息",
            documentType: "文件类型",
            caseDetails: "案件详情",
            legalRights: "您的法律权利",
            responseRequired: "回复要求截止日期",
            attachedDocument: "附件文档",
            
            // Accept notice
            acceptNotice: "接受通知",
            acceptanceRequired: "需要接受确认",
            acceptanceInstructions: "点击'接受通知'，即表示您确认收到此法律文件。这相当于签收挂号邮件。",
            acceptanceWarning: "您的签名仅确认收到，不代表同意内容。",
            transactionFee: "交易费用",
            feeSponsored: "费用已赞助 - 您无需支付",
            processing: "处理中...",
            
            // Success/Error messages
            noticeAccepted: "通知已成功接受",
            acceptanceRecorded: "您的接受记录已存储在区块链上",
            viewDocument: "查看文档",
            downloadDocument: "下载文档",
            errorAccepting: "接受通知时出错",
            errorLoading: "加载通知时出错",
            tryAgain: "重试",
            
            // Document viewer
            documentViewer: "文档查看器",
            documentEncrypted: "此文档已加密以保护您的隐私",
            decrypting: "正在解密文档...",
            print: "打印",
            download: "下载",
            close: "关闭",
            
            // Help section
            helpTitle: "使用说明",
            helpStep1: "连接您的TRON钱包或输入您的地址",
            helpStep2: "查看发送到您地址的所有法律通知",
            helpStep3: "点击'接受通知'确认收到",
            helpStep4: "访问并下载您的文档",
            helpNote: "注意：接受费用已赞助 - 您无需支付任何费用",
            
            // Footer
            securedBy: "由TRON区块链保护",
            privacyProtected: "您的隐私受端到端加密保护"
        }
    },
    
    hi: {
        name: "हिन्दी",
        flag: "🇮🇳",
        blockserved: {
            // Main titles and navigation
            title: "📬 आपके पास एक कानूनी दस्तावेज़ है",
            subtitle: "किसी ने आपको एक महत्वपूर्ण दस्तावेज़ भेजा है जिस पर आपका ध्यान देना आवश्यक है",
            selectLanguage: "भाषा चुनें",
            warningMessage: "कानूनी सूचनाओं को अनदेखा करने से आपके खिलाफ डिफ़ॉल्ट निर्णय हो सकता है",
            refresh: "रीफ्रेश",
            connectRefresh: "कनेक्ट और रीफ्रेश",
            
            // Connection section
            connectWallet: "वॉलेट कनेक्ट करें",
            connecting: "कनेक्ट हो रहा है...",
            walletConnected: "वॉलेट कनेक्ट हो गया",
            connectionError: "कनेक्शन त्रुटि",
            switchNetwork: "TRON नेटवर्क पर स्विच करें",
            installWallet: "TronLink वॉलेट इंस्टॉल करें",
            unlockWallet: "कृपया अपना वॉलेट अनलॉक करें और कनेक्ट करें",
            
            // Search section
            searchTitle: "अपनी कानूनी सूचनाएं खोजें",
            searchDescription: "सूचनाएं देखने के लिए अपना वॉलेट पता दर्ज करें या वॉलेट कनेक्ट करें",
            searchPlaceholder: "TRON वॉलेट पता दर्ज करें (T...)",
            searchButton: "सूचनाएं खोजें",
            orText: "या",
            
            // Notice display
            myNotices: "मेरी कानूनी सूचनाएं",
            noNotices: "इस पते के लिए कोई कानूनी सूचना नहीं मिली",
            noticeFrom: "भेजने वाला",
            noticeType: "प्रकार",
            caseNumber: "केस नंबर",
            dateIssued: "जारी करने की तारीख",
            deadline: "जवाब की अंतिम तिथि",
            status: "स्थिति",
            pending: "लंबित - कार्रवाई आवश्यक",
            accepted: "स्वीकृत",
            expired: "समाप्त",
            viewNotice: "सूचना देखें",
            
            // Notice details modal
            legalNoticeDetails: "कानूनी सूचना विवरण",
            issuingAgency: "जारीकर्ता एजेंसी",
            noticeInformation: "सूचना जानकारी",
            documentType: "दस्तावेज़ प्रकार",
            caseDetails: "मामले का विवरण",
            legalRights: "आपके कानूनी अधिकार",
            responseRequired: "जवाब आवश्यक तिथि",
            attachedDocument: "संलग्न दस्तावेज़",
            
            // Accept notice
            acceptNotice: "सूचना स्वीकार करें",
            acceptanceRequired: "स्वीकृति आवश्यक",
            acceptanceInstructions: "'सूचना स्वीकार करें' पर क्लिक करके, आप इस कानूनी दस्तावेज़ की प्राप्ति स्वीकार करते हैं। यह रजिस्टर्ड मेल के लिए हस्ताक्षर करने के बराबर है।",
            acceptanceWarning: "आपका हस्ताक्षर केवल प्राप्ति की पुष्टि करता है, सामग्री से सहमति नहीं।",
            transactionFee: "लेनदेन शुल्क",
            feeSponsored: "शुल्क प्रायोजित - आपके लिए कोई शुल्क नहीं",
            processing: "प्रोसेसिंग...",
            
            // Success/Error messages
            noticeAccepted: "सूचना सफलतापूर्वक स्वीकार की गई",
            acceptanceRecorded: "आपकी स्वीकृति ब्लॉकचेन पर दर्ज की गई है",
            viewDocument: "दस्तावेज़ देखें",
            downloadDocument: "दस्तावेज़ डाउनलोड करें",
            errorAccepting: "सूचना स्वीकार करने में त्रुटि",
            errorLoading: "सूचनाएं लोड करने में त्रुटि",
            tryAgain: "फिर से कोशिश करें",
            
            // Document viewer
            documentViewer: "दस्तावेज़ व्यूअर",
            documentEncrypted: "यह दस्तावेज़ आपकी गोपनीयता के लिए एन्क्रिप्ट किया गया है",
            decrypting: "दस्तावेज़ डिक्रिप्ट हो रहा है...",
            print: "प्रिंट",
            download: "डाउनलोड",
            close: "बंद करें",
            
            // Help section
            helpTitle: "यह कैसे काम करता है",
            helpStep1: "अपना TRON वॉलेट कनेक्ट करें या अपना पता दर्ज करें",
            helpStep2: "अपने पते पर भेजी गई सभी कानूनी सूचनाएं देखें",
            helpStep3: "प्राप्ति की पुष्टि के लिए 'सूचना स्वीकार करें' पर क्लिक करें",
            helpStep4: "अपने दस्तावेज़ों तक पहुंचें और डाउनलोड करें",
            helpNote: "नोट: स्वीकृति शुल्क प्रायोजित हैं - आप कुछ भी भुगतान नहीं करते",
            
            // Footer
            securedBy: "TRON ब्लॉकचेन द्वारा सुरक्षित",
            privacyProtected: "आपकी गोपनीयता एंड-टू-एंड एन्क्रिप्शन से सुरक्षित है"
        }
    }
};

// Language management functions
const LanguageManager = {
    currentLanguage: 'en',
    
    // Initialize language from localStorage or browser preference
    init() {
        // Check localStorage first
        const savedLang = localStorage.getItem('blockservedLanguage');
        if (savedLang && translations[savedLang]) {
            this.currentLanguage = savedLang;
        } else {
            // Try to detect from browser
            const browserLang = navigator.language.split('-')[0];
            if (translations[browserLang]) {
                this.currentLanguage = browserLang;
            }
        }
        
        // Apply translations on init
        this.applyTranslations();
    },
    
    // Set language and save preference
    setLanguage(langCode) {
        if (translations[langCode]) {
            this.currentLanguage = langCode;
            localStorage.setItem('blockservedLanguage', langCode);
            this.applyTranslations();
            
            // Update language selector if it exists
            const selector = document.getElementById('languageSelector');
            if (selector) {
                selector.value = langCode;
            }
        }
    },
    
    // Get translation for a key
    translate(key) {
        const keys = key.split('.');
        let translation = translations[this.currentLanguage];
        
        for (const k of keys) {
            if (translation && translation[k]) {
                translation = translation[k];
            } else {
                // Fallback to English
                translation = translations.en;
                for (const k2 of keys) {
                    if (translation && translation[k2]) {
                        translation = translation[k2];
                    } else {
                        return key; // Return key if translation not found
                    }
                }
                return translation;
            }
        }
        
        return translation;
    },
    
    // Apply translations to all elements with data-translate attribute
    applyTranslations() {
        document.querySelectorAll('[data-translate]').forEach(element => {
            const key = element.getAttribute('data-translate');
            const translation = this.translate(key);
            
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                if (element.hasAttribute('placeholder')) {
                    element.placeholder = translation;
                }
            } else {
                element.textContent = translation;
            }
        });
        
        // Update dynamic content that may have been generated
        this.updateDynamicContent();
    },
    
    // Update dynamic content that needs translation
    updateDynamicContent() {
        // This will be called when dynamic content is generated
        // to ensure it uses the current language
        
        // Update notice status badges
        document.querySelectorAll('.status-badge').forEach(badge => {
            const isSuccess = badge.classList.contains('success');
            const isWarning = badge.classList.contains('warning');
            
            if (isSuccess) {
                badge.innerHTML = `<i class="fas fa-check-circle"></i> ${this.translate('blockserved.accepted')}`;
            } else if (isWarning) {
                badge.innerHTML = `<i class="fas fa-clock"></i> ${this.translate('blockserved.pending')}`;
            }
        });
        
        // Update notice type labels
        document.querySelectorAll('[data-notice-type]').forEach(element => {
            const type = element.getAttribute('data-notice-type');
            element.textContent = this.translate(`blockserved.${type}`) || type;
        });
        
        // Update date formats based on locale
        document.querySelectorAll('[data-date]').forEach(element => {
            const timestamp = element.getAttribute('data-date');
            if (timestamp) {
                const date = new Date(parseInt(timestamp));
                element.textContent = date.toLocaleDateString(this.currentLanguage === 'zh' ? 'zh-CN' : 
                                                              this.currentLanguage === 'hi' ? 'hi-IN' : 
                                                              this.currentLanguage);
            }
        });
    },
    
    // Helper function for dynamic translations
    translateDynamic(key, defaultValue) {
        return this.translate(key) || defaultValue;
    },
    
    // Create language selector HTML
    createLanguageSelector() {
        const languages = Object.entries(translations).map(([code, lang]) => 
            `<option value="${code}">${lang.flag} ${lang.name}</option>`
        ).join('');
        
        return `
            <div class="language-selector-container" style="
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 1000;
                background: rgba(30, 41, 59, 0.95);
                border: 1px solid #334155;
                border-radius: 8px;
                padding: 8px;
                backdrop-filter: blur(10px);
            ">
                <select id="languageSelector" class="form-select" style="
                    background: #1e293b;
                    color: white;
                    border: 1px solid #475569;
                    padding: 8px 12px;
                    border-radius: 6px;
                    font-size: 16px;
                    cursor: pointer;
                " onchange="LanguageManager.setLanguage(this.value)">
                    ${languages}
                </select>
            </div>
        `;
    }
};

// Export for use
window.translations = translations;
window.LanguageManager = LanguageManager;