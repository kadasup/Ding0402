import React from 'react';
import { createPortal } from 'react-dom';

export const DialogBox = ({ children, title, color = 'var(--ac-panel)', className = '' }) => {
    return (
        <div className={`ac-panel ${className}`} style={{ background: color }}>
            {title && (
                <div className="w-full text-white py-2.5 text-center mb-6 rounded-full" style={{ background: 'linear-gradient(135deg, #78B159 0%, #6BA34D 100%)', boxShadow: '0 3px 0 #5a8c42, 0 4px 8px rgba(0,0,0,0.1)' }}>
                    <span className="font-black text-xl" style={{ letterSpacing: '0.15em' }}>{title}</span>
                </div>
            )}
            <div>
                {children}
            </div>
        </div>
    );
};

export const Button = ({ children, onClick, variant = 'primary', className = '', ...props }) => {
    const baseClass = "ac-btn";
    const variantClass = variant === 'secondary' ? 'secondary' : variant === 'danger' ? 'danger' : '';

    return (
        <button className={`${baseClass} ${variantClass} ${className}`} onClick={onClick} {...props}>
            {children}
        </button>
    );
};

export const Modal = ({ isOpen, onClose, children }) => {
    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed flex items-center justify-center p-4 bg-black bg-opacity-40 backdrop-blur-sm transition-opacity"
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2147483647 }}
            onClick={onClose}
        >
            <div className="ac-panel max-w-md w-full transform scale-100 transition-transform duration-300 relative" onClick={e => e.stopPropagation()} style={{ animation: 'bounce 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)', backgroundColor: 'white' }}>
                {children}
            </div>
        </div>,
        document.body
    );
};

export const ConfirmModal = ({ isOpen, onClose, onConfirm, icon, title, message, confirmText = '確定', cancelText = '取消', confirmColor = 'var(--ac-green)', iconBg = '#D1FAE5' }) => {
    if (!isOpen) return null;

    return createPortal(
        <div
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2147483647, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
            onClick={onClose}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    background: '#fff', borderRadius: '20px', padding: '32px 28px 24px', maxWidth: '360px', width: '100%',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.05)',
                    animation: 'bounce 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    textAlign: 'center'
                }}
            >
                {icon && (
                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '28px' }}>
                        {icon}
                    </div>
                )}
                <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1F2937', marginBottom: '8px' }}>{title}</h3>
                {message && <p style={{ fontSize: '0.9rem', color: '#6B7280', marginBottom: '24px', lineHeight: 1.5, whiteSpace: 'pre-line' }}>{message}</p>}
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={onClose}
                        style={{
                            flex: 1, padding: '12px', borderRadius: '12px', border: '2px solid #E5E7EB',
                            background: '#fff', fontWeight: 800, fontSize: '0.95rem', color: '#6B7280',
                            cursor: 'pointer', transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => { e.target.style.background = '#F3F4F6'; }}
                        onMouseLeave={e => { e.target.style.background = '#fff'; }}
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={() => { onConfirm(); onClose(); }}
                        style={{
                            flex: 1, padding: '12px', borderRadius: '12px', border: 'none',
                            background: confirmColor, fontWeight: 800, fontSize: '0.95rem', color: '#fff',
                            cursor: 'pointer', transition: 'all 0.2s',
                            boxShadow: `0 4px 12px ${confirmColor}44`
                        }}
                        onMouseEnter={e => { e.target.style.opacity = '0.85'; }}
                        onMouseLeave={e => { e.target.style.opacity = '1'; }}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

// Imperative popup hook — replaces alert() and window.confirm()
export const usePopup = () => {
    const [popup, setPopup] = React.useState(null);

    const showAlert = ({ icon = '✅', iconBg = '#D1FAE5', title, message, buttonText = '好的', buttonColor = 'var(--ac-green)' } = {}) => {
        return new Promise((resolve) => {
            setPopup({ type: 'alert', icon, iconBg, title, message, buttonText, buttonColor, resolve });
        });
    };

    const showConfirm = ({ icon = '❓', iconBg = '#FEF3C7', title, message, confirmText = '確定', cancelText = '取消', confirmColor = 'var(--ac-green)' } = {}) => {
        return new Promise((resolve) => {
            setPopup({ type: 'confirm', icon, iconBg, title, message, confirmText, cancelText, confirmColor, resolve });
        });
    };

    const close = (result) => {
        if (popup?.resolve) popup.resolve(result);
        setPopup(null);
    };

    const PopupRenderer = () => {
        if (!popup) return null;

        if (popup.type === 'alert') {
            return createPortal(
                <div
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2147483647, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
                    onClick={() => close()}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: '#fff', borderRadius: '20px', padding: '32px 28px 24px', maxWidth: '360px', width: '100%',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.05)',
                            animation: 'bounce 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                            textAlign: 'center'
                        }}
                    >
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: popup.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '28px' }}>
                            {popup.icon}
                        </div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1F2937', marginBottom: '8px' }}>{popup.title}</h3>
                        {popup.message && <p style={{ fontSize: '0.9rem', color: '#6B7280', marginBottom: '24px', lineHeight: 1.5, whiteSpace: 'pre-line' }}>{popup.message}</p>}
                        <button
                            onClick={() => close()}
                            style={{
                                width: '100%', padding: '12px', borderRadius: '12px', border: 'none',
                                background: popup.buttonColor, fontWeight: 800, fontSize: '0.95rem', color: '#fff',
                                cursor: 'pointer', transition: 'all 0.2s',
                                boxShadow: `0 4px 12px ${popup.buttonColor}44`
                            }}
                            onMouseEnter={e => { e.target.style.opacity = '0.85'; }}
                            onMouseLeave={e => { e.target.style.opacity = '1'; }}
                        >
                            {popup.buttonText}
                        </button>
                    </div>
                </div>,
                document.body
            );
        }

        // Confirm type
        return createPortal(
            <div
                style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2147483647, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
                onClick={() => close(false)}
            >
                <div
                    onClick={e => e.stopPropagation()}
                    style={{
                        background: '#fff', borderRadius: '20px', padding: '32px 28px 24px', maxWidth: '360px', width: '100%',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.05)',
                        animation: 'bounce 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                        textAlign: 'center'
                    }}
                >
                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: popup.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '28px' }}>
                        {popup.icon}
                    </div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1F2937', marginBottom: '8px' }}>{popup.title}</h3>
                    {popup.message && <p style={{ fontSize: '0.9rem', color: '#6B7280', marginBottom: '24px', lineHeight: 1.5, whiteSpace: 'pre-line' }}>{popup.message}</p>}
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            onClick={() => close(false)}
                            style={{
                                flex: 1, padding: '12px', borderRadius: '12px', border: '2px solid #E5E7EB',
                                background: '#fff', fontWeight: 800, fontSize: '0.95rem', color: '#6B7280',
                                cursor: 'pointer', transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => { e.target.style.background = '#F3F4F6'; }}
                            onMouseLeave={e => { e.target.style.background = '#fff'; }}
                        >
                            {popup.cancelText}
                        </button>
                        <button
                            onClick={() => close(true)}
                            style={{
                                flex: 1, padding: '12px', borderRadius: '12px', border: 'none',
                                background: popup.confirmColor, fontWeight: 800, fontSize: '0.95rem', color: '#fff',
                                cursor: 'pointer', transition: 'all 0.2s',
                                boxShadow: `0 4px 12px ${popup.confirmColor}44`
                            }}
                            onMouseEnter={e => { e.target.style.opacity = '0.85'; }}
                            onMouseLeave={e => { e.target.style.opacity = '1'; }}
                        >
                            {popup.confirmText}
                        </button>
                    </div>
                </div>
            </div>,
            document.body
        );
    };

    return { showAlert, showConfirm, PopupRenderer };
};

