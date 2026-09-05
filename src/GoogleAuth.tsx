import React, { useEffect, useRef } from "react";
import { LogOut, ShieldCheck } from "lucide-react";

export interface GoogleUser {
  email: string;
  name: string;
  picture: string;
  sub: string;
  token?: string;
}

interface GoogleAuthProps {
  user: GoogleUser | null;
  onSignIn: (user: GoogleUser) => void;
  onSignOut: () => void;
  clientId?: string;
  buttonId?: string;
  compact?: boolean;
}

// Decode Google JWT ID token payload safely
export function parseJwt(token: string): any {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (err) {
    console.error("Failed to parse Google JWT token:", err);
    return null;
  }
}

export const GOOGLE_CLIENT_ID =
  (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ||
  (import.meta as any).env?.GOOGLE_CLIENT_ID ||
  "299556828507-kiclj2qnevlics1mo8c35q5ugqp4vvbu.apps.googleusercontent.com";

let isGsiInitialized = false;
let hasAutoPrompted = false;
const globalSignInCallbacks = new Set<(user: GoogleUser) => void>();

export function initializeGoogleIdentity(
  clientId: string,
  callback?: (user: GoogleUser) => void
) {
  if (callback) {
    globalSignInCallbacks.add(callback);
  }

  if (!isGsiInitialized && (window as any).google?.accounts?.id) {
    isGsiInitialized = true;
    (window as any).google.accounts.id.initialize({
      client_id: clientId,
      callback: (response: any) => {
        if (response.credential) {
          const payload = parseJwt(response.credential);
          if (payload) {
            const newUser: GoogleUser = {
              email: payload.email,
              name: payload.name || payload.email.split("@")[0],
              picture: payload.picture,
              sub: payload.sub,
              token: response.credential
            };
            globalSignInCallbacks.forEach((cb) => cb(newUser));
          }
        }
      },
      auto_select: true,
      use_fedcm_for_prompt: true
    });
  }
}

export function promptGoogleSignIn(
  clientId: string = GOOGLE_CLIENT_ID,
  callback?: (user: GoogleUser) => void,
  force: boolean = false
) {
  if (callback) {
    globalSignInCallbacks.add(callback);
  }

  if (!clientId) {
    console.error("Cannot prompt Google Sign-In: missing client ID.");
    return;
  }

  if (!force && hasAutoPrompted) {
    return;
  }
  hasAutoPrompted = true;

  const triggerPrompt = () => {
    initializeGoogleIdentity(clientId, callback);
    if ((window as any).google?.accounts?.id) {
      try {
        (window as any).google.accounts.id.prompt((notification: any) => {
          if (notification?.isNotDisplayed?.()) {
            console.warn(
              "Google Sign-In prompt not displayed:",
              notification.getNotDisplayedReason?.()
            );
          } else if (notification?.isSkippedMoment?.()) {
            console.log(
              "Google Sign-In prompt skipped:",
              notification.getSkippedReason?.()
            );
          } else if (notification?.isDismissedMoment?.()) {
            console.log(
              "Google Sign-In prompt dismissed:",
              notification.getDismissedReason?.()
            );
          }
        });
      } catch (err) {
        console.error("Error triggering Google Sign-In prompt:", err);
      }
    }
  };

  if ((window as any).google?.accounts?.id) {
    triggerPrompt();
  } else {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if ((window as any).google?.accounts?.id) {
        clearInterval(interval);
        triggerPrompt();
      } else if (attempts > 30) {
        clearInterval(interval);
        console.warn("Google Identity Services script did not load within 7.5 seconds.");
      }
    }, 250);
  }
}

export function GoogleAuth({
  user,
  onSignIn,
  onSignOut,
  clientId = GOOGLE_CLIENT_ID,
  buttonId = "google-signin-btn",
  compact = false
}: GoogleAuthProps) {
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) return;

    if (!clientId) {
      console.error(
        "Google sign-in is misconfigured: VITE_GOOGLE_CLIENT_ID was not set at build time, " +
          "so no OAuth client_id is available. Rebuild with --build-arg VITE_GOOGLE_CLIENT_ID=<your_client_id>."
      );
      return;
    }

    const setupGsiButton = () => {
      initializeGoogleIdentity(clientId, onSignIn);

      if ((window as any).google?.accounts?.id && buttonRef.current) {
        buttonRef.current.innerHTML = ""; // Clear existing button before rendering
        (window as any).google.accounts.id.renderButton(buttonRef.current, {
          theme: "filled_blue",
          size: compact ? "medium" : "large",
          text: "signin_with",
          shape: "rectangular",
          logo_alignment: "left"
        });
      }
    };

    if ((window as any).google?.accounts?.id) {
      setupGsiButton();
    } else {
      const interval = setInterval(() => {
        if ((window as any).google?.accounts?.id) {
          clearInterval(interval);
          setupGsiButton();
        }
      }, 250);
      return () => clearInterval(interval);
    }
  }, [user, clientId, compact]);

  const handleSignOutClick = () => {
    hasAutoPrompted = false;
    if ((window as any).google?.accounts?.id) {
      (window as any).google.accounts.id.disableAutoSelect();
    }
    onSignOut();
  };

  if (user) {
    return (
      <div className="flex items-center gap-2.5 bg-[#1a1d26] border border-indigo-500/30 px-3 py-1.5 rounded-lg shadow-sm">
        {user.picture ? (
          <img
            src={user.picture}
            alt={user.name}
            className="w-7 h-7 rounded-full border border-indigo-400/40 object-cover"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
            {user.name.charAt(0).toUpperCase()}
          </div>
        )}

        <div className="flex flex-col text-left">
          <span className="text-xs font-semibold text-gray-200 truncate max-w-[120px] md:max-w-[160px]">
            {user.name}
          </span>
          <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
            <ShieldCheck size={10} /> Google Account
          </span>
        </div>

        <button
          onClick={handleSignOutClick}
          className="ml-1 text-gray-400 hover:text-red-400 p-1 transition-colors rounded hover:bg-white/5 cursor-pointer"
          title="Sign out of Google Account"
        >
          <LogOut size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div 
        ref={buttonRef} 
        id={buttonId}
        className={compact ? "min-h-[36px]" : "min-h-[40px]"}
      ></div>
    </div>
  );
}
