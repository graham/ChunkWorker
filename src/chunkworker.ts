
function genThreadId(): string {
    return String(new Date().getTime()) + String(Math.random());
};

class ChunkWorker {
    items: Array<any>;
    chunk_size: number;
    delay_ms: number;

    constructor(items: Array<any>, chunk_size?: number) {
        this.items = items;
        this.chunk_size = chunk_size || 10;
        this.delay_ms = 1000;
    }

    forChunk(callback: (items: Array<any>) => Promise<any>): Promise<any> {
        return new Promise((resolve, reject) => {
            let iterator = (worker: ChunkWorker) => {
                if (worker.items.length == 0) {
                    resolve();
                    return;
                }

                const workable_items = worker.items.slice(0, worker.chunk_size);
                worker.items = worker.items.slice(worker.chunk_size, worker.items.length);

                callback(workable_items).then(() => {
                    setTimeout(() => {
                        iterator(worker);
                    }, this.delay_ms);
                });
            };

            iterator(this);
        });
    }

    forChunkPar(callback: (items: Array<any>) => Promise<any>): Promise<any> {
        return new Promise((resolve, reject) => {
            let promises: Array<Promise<any>> = [];

            while (this.items.length > 0) {
                const workable_items = this.items.slice(0, this.chunk_size);
                this.items = this.items.slice(this.chunk_size, this.items.length);
                promises.push(callback(workable_items));
            }

            return Promise.all(promises);
        });
    }

    forChunkParCount(callback: (items: Array<any>) => Promise<any>): Promise<any> {
        const threadCount = 3;

        return new Promise((resolve, reject) => {
            let runningPromises: { [id: string]: Promise<any> } = {};
            let chunks: Array<any> = [];

            while (this.items.length > 0) {
                const workable_items = this.items.slice(0, this.chunk_size);
                this.items = this.items.slice(this.chunk_size, this.items.length);
                chunks.push(workable_items);
            }

            let startWorker = () => {
                if (chunks.length == 0) {
                    setTimeout(() => {
                        mainRunner();
                    }, 0);
                    return;
                }

                let threadId: string = genThreadId();
                let work = chunks[0];
                chunks = chunks.slice(1, chunks.length);

                runningPromises[threadId] = callback(work);
                runningPromises[threadId].then(() => {
                    delete runningPromises[threadId];
                    setTimeout(() => {
                        mainRunner();
                    }, this.delay_ms);
                });
            };

            let mainRunner = () => {
                let runningThreads = Object.keys(runningPromises);
                if (runningThreads.length == 0 && chunks.length == 0) {
                    resolve();
                    return;
                }

                if (runningThreads.length >= threadCount) {
                    // we assume when one of the workers finishes,
                    // we will call the main runner once again.
                    return;
                } else {
                    startWorker();
                    setTimeout(() => {
                        mainRunner();
                    }, 10);
                }
            };

            mainRunner();
        });
    };
}
