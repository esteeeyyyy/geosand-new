<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class NotificationController extends Controller
{
    /**
     * Get paginated notifications for the authenticated user.
     */
    public function index(Request $request): JsonResponse
    {
        $notifications = $request->user()->notifications()->paginate(10);

        return response()->json([
            'notifications' => $notifications,
        ]);
    }

    /**
     * Get the count of unread notifications.
     */
    public function unreadCount(Request $request): JsonResponse
    {
        return response()->json([
            'count' => $request->user()->unreadNotifications()->count(),
        ]);
    }

    /**
     * Mark specific or all notifications as read.
     */
    public function markAsRead(Request $request): JsonResponse
    {
        $request->validate([
            'id' => 'nullable|string'
        ]);

        if ($request->has('id') && $request->id) {
            $notification = $request->user()->notifications()->where('id', $request->id)->first();
            if ($notification) {
                $notification->markAsRead();
            }
        } else {
            $request->user()->unreadNotifications->markAsRead();
        }

        return response()->json([
            'message' => 'Notifications marked as read',
            'unread_count' => $request->user()->unreadNotifications()->count(),
        ]);
    }
}
