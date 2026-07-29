import React from 'react';
import { Linking } from 'react-native';
import { Dialog, Portal, Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';

// Shown when useUpdateCheck() finds a newer build than the one running.
// "Actualizar" hands the APK URL to the OS browser/download manager, which
// downloads it and prompts the user to install — same signing key as the
// current install (shared debug.keystore) means it installs in place.
const UpdateDialog = ({ updateInfo, onDismiss }) => {
    const { t } = useTranslation();

    if (!updateInfo) {
        return null;
    }

    return (
        <Portal>
            <Dialog visible dismissable={false}>
                <Dialog.Title>{t('update.title')}</Dialog.Title>
                <Dialog.Content>
                    <Text variant="bodyMedium">
                        {t('update.message', { version: updateInfo.versionName })}
                    </Text>
                    {!!updateInfo.notes && (
                        <Text variant="bodySmall" style={{ marginTop: 8 }}>
                            {updateInfo.notes}
                        </Text>
                    )}
                </Dialog.Content>
                <Dialog.Actions>
                    <Button onPress={onDismiss}>{t('update.later')}</Button>
                    <Button
                        mode="contained"
                        onPress={() => {
                            Linking.openURL(updateInfo.apkUrl);
                            onDismiss();
                        }}
                    >
                        {t('update.now')}
                    </Button>
                </Dialog.Actions>
            </Dialog>
        </Portal>
    );
};

export default UpdateDialog;
