import type { ReactNode } from "react";
import { ShortcutCaptureModal } from "./ShortcutCaptureModal";

type Props = {
  open: boolean;
  initialShortcut: string;
  onClose: () => void;
  onSave: (shortcut: string) => void;
};

export function CopyHotkeyModal({
  open,
  initialShortcut,
  onClose,
  onSave,
}: Props) {
  const description: ReactNode = (
    <>
      将复制<strong>当前分号块</strong>（格式化后、不含分号），与主界面「复制」一致。
    </>
  );

  return (
    <ShortcutCaptureModal
      open={open}
      title="配置复制快捷键"
      description={description}
      initialShortcut={initialShortcut}
      onClose={onClose}
      confirmLabel="保存"
      onConfirm={(s) => {
        onSave(s);
        onClose();
      }}
    />
  );
}
