import React, { useState } from 'react';
import { View } from 'react-native';
import { Portal, Dialog, Button, TextInput, Text } from 'react-native-paper';

const EventDialog = ({ visible, onDismiss, onSubmit }) => {
    const [title, setTitle] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');

    const handleSubmit = () => {
        if (title.trim() && date.trim()) {
            onSubmit({ title, date, time });
            setTitle('');
            setDate('');
            setTime('');
            onDismiss();
        }
    };

    return (
        <Portal>
            <Dialog visible={visible} onDismiss={onDismiss}>
                <Dialog.Title>Crear Evento</Dialog.Title>
                <Dialog.Content>
                    <TextInput
                        label="Título del Evento"
                        value={title}
                        onChangeText={setTitle}
                        mode="outlined"
                        style={{ marginBottom: 10 }}
                    />
                    <TextInput
                        label="Fecha (ej. 15 Octubre)"
                        value={date}
                        onChangeText={setDate}
                        mode="outlined"
                        style={{ marginBottom: 10 }}
                    />
                    <TextInput
                        label="Hora (ej. 20:00)"
                        value={time}
                        onChangeText={setTime}
                        mode="outlined"
                    />
                </Dialog.Content>
                <Dialog.Actions>
                    <Button onPress={onDismiss}>Cancelar</Button>
                    <Button onPress={handleSubmit} disabled={!title.trim() || !date.trim()}>Enviar</Button>
                </Dialog.Actions>
            </Dialog>
        </Portal>
    );
};

export default EventDialog;
