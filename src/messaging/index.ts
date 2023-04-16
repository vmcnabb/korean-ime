
export type KimeMessage = {
    action: string,
    data: string
}

export type KimeResponse = {
    wasSuccessful?: boolean,
    state?: any
}

export function IsKimeMessage(message: any): message is KimeMessage {
    return "action" in message;
}
