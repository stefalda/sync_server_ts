import { DatabaseRepository } from "./database_repository";

export class SyncRepository {

    private static instance: SyncRepository;



    private constructor() {

    }



    public static getInstance(): SyncRepository {
        if (!SyncRepository.instance) {
            SyncRepository.instance = new SyncRepository();
        }

        return SyncRepository.instance;
    }

    // Instance methods

    private async getDB() {
        return await DatabaseRepository.getInstance();

    }


}

