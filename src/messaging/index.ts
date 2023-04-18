
export type KimeMessage = {
    action: string,
    data: string
}

export function IsKimeMessage(message: any): message is KimeMessage {
    return "action" in message;
}
