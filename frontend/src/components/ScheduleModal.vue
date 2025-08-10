<template>
  <div class="modal-backdrop" @click.self="close">
    <div class="modal-content">
      <h2 class="modal-header">{{ event.id ? '予定の編集' : '新しい予定' }}</h2>
      <form @submit.prevent="handleSubmit">
        <div class="form-group">
          <label for="title">タイトル</label>
          <input type="text" id="title" v-model="editableEvent.title" required>
        </div>
        <div class="form-group">
          <label for="start">開始日時</label>
          <input type="datetime-local" id="start" v-model="editableEvent.start" required>
        </div>
        <div class="form-group">
          <label for="end">終了日時</label>
          <input type="datetime-local" id="end" v-model="editableEvent.end" required>
        </div>
        <div class="modal-actions">
          <button type="button" class="button-danger" v-if="event.id" @click="handleDelete">削除</button>
          <button type="button" class="button-secondary" @click="close">キャンセル</button>
          <button type="submit" class="button-primary">保存</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  event: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(['close', 'save', 'delete']);

const editableEvent = ref({ ...props.event });

watch(() => props.event, (newEvent) => {
  editableEvent.value = { ...newEvent };
});

const handleSubmit = () => {
  emit('save', editableEvent.value);
};

const handleDelete = () => {
  emit('delete', editableEvent.value.id);
};

const close = () => {
  emit('close');
};
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
}

.modal-header {
  font-size: 1.5rem;
  font-weight: bold;
  margin-bottom: 1.5rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
}

.form-group input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 2rem;
}
</style>
