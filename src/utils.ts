class QueueNode<T> {
	public value: T;
	public next: QueueNode<T> | null;

	public constructor(value: T) {
		this.value = value;
		this.next = null;
	}
}

export class Queue<T> {
	protected head: QueueNode<T> | null = null;
	protected tail: QueueNode<T> | null = null;
	protected size: number = 0;

	public push(value: T): void {
		let new_tail = new QueueNode<T>(value);
		if (this.tail === null) {
			this.tail = this.head = new_tail;
		} else {
			this.tail.next = new_tail;
			this.tail = new_tail;
		}
		this.size++;
	}

	public pop(): T | null {
		if (this.head === null) {
			return null;
		} else {
			this.size--;
			let item = this.head.value;
			this.head = this.head.next;
			if (this.head === null) {
				this.tail = null;
			}
			return item;
		}
	}

	public peek(): T | null {
		if (this.head === null) {
			return null;
		} else {
			return this.head.value;
		}
	}

	public is_empty(): boolean {
		return this.size === 0;
	}

	public get_size(): number {
		return this.size;
	}
}
