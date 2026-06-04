

# 개요
요구사항이 완료될 때 요청알림(docs/domain/11-request-notification.md)을 발생시킬 수 있다.

# 시나리오
요구사항 상세 알림이나 상세 모달에서 완료알림을 발생시킬 수 있다.
특정 요구사항 다음에는 다음 이어서할 수 있는 작업이 있다.

상세페이지에서 완료알림이라는 영역을 펼침시키면,
해당 같은 기능 내에 있는 요구사항들을 SELECT 로 선택할 수 있으며, 선택된 요구사항 id 와 특정 그룹혹은 특정 개인을 선택하여 미리 알림 예약을 해둘 수 있다.

이렇게 설정된 노드에서 상태(Node.status)가 완료(DONE)로 변경되면 이 알림을 발생시켜서 요청(docs/domain/11-request-notification.md)을 보내둔다.
알림예약의 경우 group_id, receiver_id 를 미리 설정해두고, Node 상태변경될 때 알림(docs/domain/11-request-notification.md)이 생성되는 형태인데,


# 테이블
테이블명 : complete_notification

id: primary key, auto increment
group_id: 요청을 받은 그룹의 id (number, member_group 테이블의 id 참조)
receiver_id: 요청을 받은 사람의 id (number, member 테이블의 id 참조)


알림예약을 삭제할 수도 있다.
