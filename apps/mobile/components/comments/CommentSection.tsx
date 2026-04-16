import { useEffect } from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { trpc } from "../../utils/trpc";
import { useApp } from "../../context/AppContext";
import { CommentItem } from "./CommentItem";
import { CommentComposer } from "./CommentComposer";

export function CommentSection({ careEventId }: { careEventId: string }) {
  const { user } = useApp();
  const list = trpc.careEvents.comments.list.useQuery({ careEventId });
  const add = trpc.careEvents.comments.add.useMutation({
    onSuccess: () => list.refetch(),
  });
  const edit = trpc.careEvents.comments.edit.useMutation({
    onSuccess: () => list.refetch(),
  });
  const remove = trpc.careEvents.comments.remove.useMutation({
    onSuccess: () => list.refetch(),
  });

  return (
    <View style={{ marginTop: 16 }}>
      <Text
        style={{
          fontWeight: "600",
          fontSize: 16,
          paddingHorizontal: 16,
          marginBottom: 8,
        }}
      >
        Comments
      </Text>
      <FlatList
        data={list.data ?? []}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => (
          <CommentItem
            comment={item}
            currentUserId={user?.id ?? ""}
            onEdit={(id, body) => edit.mutate({ commentId: id, body })}
            onDelete={(id) => remove.mutate({ commentId: id })}
          />
        )}
        scrollEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={list.isFetching}
            onRefresh={() => list.refetch()}
          />
        }
        ListEmptyComponent={
          <Text style={{ paddingHorizontal: 16, color: "#6b7280" }}>
            Be the first to comment.
          </Text>
        }
      />
      <CommentComposer
        onSubmit={async (body) => {
          await add.mutateAsync({ careEventId, body });
        }}
      />
    </View>
  );
}
